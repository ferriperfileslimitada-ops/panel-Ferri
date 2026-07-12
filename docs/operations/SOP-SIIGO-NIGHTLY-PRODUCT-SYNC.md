# SOP operativo — sincronización nocturna de productos Siigo

**Sistema:** Panel Ferriperfiles / Siigo Nube / n8n / Supabase  
**Versión:** 1.0  
**Zona horaria:** `America/Bogota`  
**Frecuencia:** todos los días a las 00:00  
**Propietario operativo:** Administración Ferriperfiles

## 1. Propósito

Mantener en Supabase una réplica operativa de productos de Siigo sin duplicar registros ni alterar identificadores internos. La ejecución actualiza código, nombre, precio de venta, stock e IVA y registra los productos que requieren revisión.

Siigo es la fuente de verdad para el catálogo, precio y disponibilidad. Supabase es la réplica operativa y analítica usada por el panel.

## 2. Resultado esperado

Cada ejecución nocturna debe:

1. Autenticarse contra Siigo.
2. Paginar todos los productos disponibles.
3. Consultar el detalle de cada producto con una velocidad limitada.
4. Crear o actualizar el producto local por `code`.
5. Mantener el UUID interno `supa_id` separado del UUID externo de Siigo.
6. Registrar como incidencias los productos sin precio, con stock negativo o con errores de Siigo.

La ejecución es idempotente: repetirla actualiza por `code` y no crea duplicados.

## 3. Identidad de producto

| Campo | Significado | Regla |
|---|---|---|
| `productos.supa_id` | UUID interno de Supabase | Nunca proviene de Siigo ni se sobrescribe en sincronizaciones normales. |
| `productos.code` | Código comercial / SKU de Siigo | Clave de coincidencia para crear o actualizar. |
| `siigo_entity_map.siigo_id` | UUID externo de Siigo | Identificador de la entidad en Siigo. |
| `siigo_entity_map.local_record_id` | Referencia local | Debe contener `productos.supa_id` como texto. |

**Nunca ejecutar** `003_atomic_siigo_product_sync.sql`: usa los nombres y la lógica anteriores a la normalización de identidad. La función vigente es `public.sync_siigo_producto` definida por la migración `004_producto_identity_naming.sql`.

## 4. Componentes y flujo

```text
Schedule Trigger (00:00 Colombia) o Manual Trigger
  → Siigo · Autenticar
  → Siigo · Consultar productos
  → Siigo · Separar productos
  → Siigo · Detalle producto
  → Siigo · Ver campos
  → IF
      ├─ true  → Supabase · Sincronizar producto
      └─ false → Supabase · Registrar incidencia

Siigo · Detalle producto (Error Branch)
  → Siigo · Preparar error de detalle
  → Supabase · Registrar incidencia
```

### Recursos Supabase relevantes

- `public.productos`: catálogo operativo.
- `public.siigo_entity_map`: mapa local ↔ Siigo.
- `public.siigo_sync_issues`: incidencias de entrada abiertas.
- `public.sync_siigo_producto(...)`: RPC atómica para crear/actualizar por `code`.
- `public.record_siigo_sync_issue(...)`: RPC que registra o incrementa una incidencia sin duplicarla.

## 5. Configuración aprobada de n8n

### Programación

- Nodo: `Cada noche · Sincronizar productos`.
- Intervalo: diario.
- Hora: `00:00`.
- Zona horaria del workflow: `America/Bogota`.
- El workflow debe permanecer publicado/activo.

### Consulta paginada

Nodo: `Siigo · Consultar productos`.

- Endpoint: `GET /v1/products`.
- `page_size`: `10`.
- Paginación: actualizar parámetro de consulta `page` con `{{ $pageCount + 1 }}`.
- Finalización: `{{ ($response.body.results ?? []).length === 0 }}`.
- Máximo de páginas: `150` como protección.
- Intervalo entre solicitudes: `3000 ms`.

No usar la opción “Response Is Empty”: Siigo devuelve un objeto de paginación aun cuando `results` está vacío y el workflow podría no terminar.

### Detalle de producto

Nodo: `Siigo · Detalle producto`.

- Endpoint: `GET /v1/products/{{ $json.id }}`.
- Lote: 1 elemento.
- Intervalo: `1200 ms`.
- Reintentos: 3 intentos, 5000 ms entre intentos.
- En error: continuar por la salida de error.

### Validación antes de escribir

Un producto llega a la rama `true` únicamente si:

- Tiene un precio numérico no negativo en la lista de venta activa de posición 1.
- Tiene stock numérico no negativo.

Se registra una incidencia si falta el precio o el stock es negativo. El workflow no reemplaza valores inválidos por cero.

### Escritura en Supabase

- Nodo `Supabase · Sincronizar producto`: llama `POST /rest/v1/rpc/sync_siigo_producto` con credencial `Supabase API` de servidor.
- Nodo `Supabase · Registrar incidencia`: llama `POST /rest/v1/rpc/record_siigo_sync_issue`.
- Ambos nodos deben reintentar 3 veces y continuar por salida de error ante un fallo aislado.

## 6. Operación normal

### Antes de la primera ejecución programada

1. Confirmar que el workflow está activo y con zona horaria `America/Bogota`.
2. Confirmar que no hay otra ejecución de productos en curso.
3. Confirmar que las credenciales de Siigo y Supabase existen en n8n y no están visibles en nodos ni capturas.

### Durante la ejecución

La carga completa puede durar aproximadamente 25–35 minutos: la API de Siigo exige solicitudes espaciadas. No iniciar manualmente una segunda ejecución mientras la nocturna está en curso.

### Después de la ejecución

Revisar en Supabase:

```sql
SELECT
  issue_type,
  count(*) AS productos,
  sum(occurrences) AS apariciones
FROM public.siigo_sync_issues
WHERE entity_type = 'product'
  AND resolved_at IS NULL
GROUP BY issue_type
ORDER BY issue_type;
```

Revisar integridad de los mapas:

```sql
SELECT
  count(*) AS productos_mapeados,
  count(*) FILTER (WHERE local_record_id = siigo_id) AS ids_iguales,
  count(*) FILTER (WHERE sync_status <> 'synced') AS estados_no_sincronizados
FROM public.siigo_entity_map
WHERE entity_type = 'product';
```

Resultado obligatorio: `ids_iguales = 0` y `estados_no_sincronizados = 0`.

## 7. Gestión de incidencias

| Tipo | Significado | Acción operativa |
|---|---|---|
| `missing_price` | El producto no tiene precio válido en la lista de venta 1. | Completar/corregir el precio en Siigo y verificar la siguiente corrida. |
| `negative_stock` | Siigo reporta stock negativo. | Revisar inventario en Siigo; no se fuerza a cero en el panel. |
| `siigo_api_error` | Siigo respondió con un fallo persistente tras reintentos. | Reintentar en la siguiente ejecución y escalar a soporte Siigo si persiste. |
| `supabase_error` | El RPC local falló después de sus reintentos. | Revisar la ejecución y el mensaje técnico antes de reintentar. |

Al resolver una incidencia, documentar la corrección y establecer `resolved_at` y `resolution_note`. No borrar historial de incidencias.

## 8. Runbooks de fallo

### Siigo responde 429: demasiadas solicitudes

1. No relanzar inmediatamente el workflow.
2. Esperar al menos dos minutos.
3. Verificar que los intervalos de paginación y detalle siguen en 3000 ms y 1200 ms respectivamente.
4. Reintentar una sola vez.

### Siigo responde 500 en un detalle

1. n8n reintenta tres veces.
2. Si falla, el producto debe ir a `siigo_api_error` y el resto continúa.
3. Si la incidencia aparece tres noches consecutivas, abrir caso con soporte de Siigo incluyendo fecha, código y mensaje, sin adjuntar credenciales.

### Supabase rechaza un producto

1. Revisar si el producto fue enviado a `negative_stock` o `missing_price`.
2. Si se trata de otro error, revisar la salida `Supabase · Errores para revisar`.
3. No desactivar restricciones de base de datos para “hacer pasar” el producto.

### El workflow no termina

1. Detener la ejecución.
2. Revisar el nodo de paginación: debe usar la expresión sobre `results.length`, no “Response Is Empty”.
3. Verificar que el límite máximo de páginas está activo.

## 9. Seguridad y cambios

- Las credenciales son exclusivas del servidor/n8n; nunca pegarlas en el repositorio, SQL, chat o capturas.
- Configuración recomendada de n8n para esta integración:

```text
EXECUTIONS_DATA_SAVE_ON_SUCCESS=none
EXECUTIONS_DATA_SAVE_ON_ERROR=none
EXECUTIONS_DATA_SAVE_MANUAL=false
```

- Antes de migraciones que modifiquen identificadores, tomar y verificar un respaldo PostgreSQL en formato custom.
- Las migraciones aplicadas relevantes son `002`, `004`, `005` y `006`.
- La migración `005` normalizó 712 IDs heredados y preservó referencias de cotizaciones mediante `ON UPDATE CASCADE`.
- Cualquier cambio de mapeo, precio, stock, concurrencia o paginación debe probarse manualmente antes de publicarse.

## 10. Línea base inicial

La primera carga validada registró:

- 1.208 productos listados en Siigo.
- 1.070 productos sincronizados.
- 100 incidencias `missing_price`.
- 37 incidencias `negative_stock`.
- 1 error transitorio de detalle Siigo que debe quedar cubierto por la rama de errores en corridas posteriores.

Estas cifras son una línea base, no un objetivo fijo: se espera que cambien cuando se corrijan los datos en Siigo o se creen productos nuevos.

## 11. Criterio de salud

El proceso se considera saludable cuando:

- La ejecución programada termina sin detener la cadena.
- No hay duplicados por `code`.
- Los mapas no reutilizan IDs de Siigo como `supa_id`.
- Las incidencias quedan registradas y son revisables.
- Existen tres ejecuciones nocturnas consecutivas correctas.

