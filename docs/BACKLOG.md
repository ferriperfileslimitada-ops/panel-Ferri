# Backlog de producto y ejecución — Panel Ferriperfiles

**Versión:** 1.0  
**Actualizado:** 2026-07-10  
**Objetivo:** convertir el Panel Ferriperfiles en la fuente operativa de trabajo diario, sincronizada de forma segura y trazable con Siigo.

**Plan técnico detallado:** [Siigo MCP e integración Ferriperfiles](./SIIGO_MCP_EXECUTION_PLAN.md)

## Norte del producto

El panel debe permitir operar clientes, productos, cotizaciones, facturas y despachos sin duplicar trabajo. Siigo permanece como sistema contable/ERP de referencia; el panel conserva una réplica operativa y analítica para consultas rápidas y decisiones de negocio.

> **Decisión de arquitectura inicial:** MCP puede servir como interfaz de herramientas para agentes y soporte operativo, pero no debe ser el mecanismo principal de sincronización productiva. La sincronización debe usar la API oficial de Siigo, una cola/outbox, registros de sincronización e idempotencia. Esto evita pérdidas, duplicados y cambios no auditables.

## Estado actual conocido

- La interfaz ya cuenta con productos, clientes, cotizaciones, despachos, analítica y autenticación sobre Supabase.
- Existe una integración Siigo en Node y un cliente Python/servicio OCR.
- El OCR está pausado: se conectó Google Vision, pero no procesa correctamente aún.
- El panel tiene vistas analíticas, pero falta una capa confiable de datos sincronizados para indicadores operativos y comerciales.

## Prioridades

| Prioridad | Resultado | Estado | Criterio de terminado |
|---|---|---|---|
| P0 | Seguridad y base operativa | Pendiente | Secretos fuera del código, entornos configurados, trazabilidad mínima y respaldo de datos. |
| P0 | Sincronización base con Siigo | Pendiente | Clientes y productos se sincronizan sin duplicados, con resultado/auditoría por ejecución. |
| P1 | Actualización nocturna | Pendiente | Job diario a las 00:00 Colombia actualiza productos, stock, precios y clientes; alerta si falla. |
| P1 | Sincronización de operaciones | Pendiente | Crear/editar entidades desde el panel propaga cambios a Siigo con reintentos seguros. |
| P1 | Analítica comercial confiable | Pendiente | Ventas diarias/mensuales y KPIs se alimentan de datos sincronizados con fecha de corte visible. |
| P2 | OCR de facturas de compra | En pausa | Imagen/PDF → datos validados → borrador en Siigo, con revisión humana obligatoria. |

## Backlog priorizado

### P0 — Fundaciones

- [ ] **SEC-01 · Proteger credenciales y configuración.** Mover todos los secretos a variables de entorno/gestor de secretos, rotar los expuestos y documentar las variables requeridas.
- [ ] **OPS-01 · Definir entornos.** Establecer desarrollo, pruebas y producción; documentar URL de frontend, API, OCR y Supabase.
- [ ] **DATA-01 · Crear trazabilidad de sincronización.** Tablas para `sync_runs`, `sync_events`, mapeos de IDs Siigo↔Supabase, errores y reintentos.
- [ ] **DATA-02 · Definir fuente de verdad por entidad.** Acordar qué sistema gana en conflictos: clientes, productos, precios, stock, cotizaciones, facturas y ventas.

### P0 — Sincronización inicial Siigo

- [ ] **MCP-01 · Crear fork controlado del MCP Siigo.** Fijar versión/commit, auditar dependencias y transporte, y deshabilitar herramientas destructivas.
- [ ] **MCP-02 · Publicar perfil MCP de solo lectura.** Conectar sandbox/pruebas, autenticar consumidores y auditar cada llamada.
- [ ] **MCP-03 · Integrar MCP con n8n.** Validar MCP Client; añadir gateway remoto autenticado si el servidor base solo expone transporte local.
- [ ] **SIG-01 · Auditoría de capacidades Siigo.** Confirmar endpoints, paginación, límites, filtros por fecha, webhooks/disponibilidad y campos de productos, inventario, clientes, cotizaciones y facturas.
- [ ] **SIG-02 · Implementar sincronización de clientes Siigo → Supabase.** Alta, actualización, desactivación y mapeo de ID externo; ejecución idempotente.
- [ ] **SIG-03 · Implementar sincronización de productos Siigo → Supabase.** SKU/código, nombre, precio, impuestos, estado y campos disponibles de inventario.
- [ ] **SIG-04 · Pantalla y registro de estado de sincronización.** Última ejecución, registros creados/actualizados/omitidos, errores descargables y acción de reintento.

### P1 — Actualización nocturna

- [ ] **JOB-01 · Implementar scheduler a las 00:00 America/Bogota.** Ejecutar clientes y productos diariamente; evitar ejecuciones simultáneas mediante lock.
- [ ] **JOB-02 · Actualizar stock, precios y nuevos productos.** Aplicar cambios por lote, con conteos y validaciones antes de publicar los datos en el panel.
- [ ] **JOB-03 · Alertas operativas.** Notificar por correo/Slack cuando el job falle, no termine o encuentre diferencias anómalas.
- [ ] **JOB-04 · Reconciliación manual.** Acción administrativa para ejecutar y revisar una sincronización bajo demanda sin corromper el job programado.

### P1 — Escritura desde el panel hacia Siigo

- [ ] **SIG-05 · Patrón outbox.** Cada cambio local crea un evento persistente; un worker lo envía a Siigo, registra respuesta y reintenta errores recuperables.
- [ ] **SIG-06 · Sincronizar cambios de clientes y productos.** Crear/editar desde el panel se refleja en Siigo con validación, idempotencia y estado visible.
- [ ] **SIG-07 · Sincronizar cotizaciones.** Crear/editar/enviar cotización preservando el ID de Siigo y evitando duplicar documentos.
- [ ] **SIG-08 · Definir flujo de facturación.** Acordar si la factura nace en Siigo, en el panel o desde una cotización pagada; automatizar solo después de validarlo con contabilidad.

### P1 — Analítica estilo Power BI

- [ ] **BI-01 · Modelo analítico.** Crear tablas/vistas agregadas para ventas diarias, mensuales, clientes, productos, margen (si hay costo) y desempeño de cotizaciones.
- [ ] **BI-02 · Dashboard ejecutivo.** KPIs: ventas hoy/mes, comparación con período anterior, ticket promedio, top productos/clientes, cotizaciones ganadas/perdidas y alertas de stock.
- [ ] **BI-03 · Actualización y calidad de datos.** Mostrar “actualizado a las…”; mantener histórico de cierres diarios y controles de consistencia con Siigo.
- [ ] **BI-04 · Exportación y filtros.** Filtros por período, vendedor, cliente y producto; exportación segura para operaciones y gerencia.

### P2 — OCR de facturas

- [ ] **OCR-01 · Diagnóstico reproducible.** Conservar 5–10 facturas anonimizadas/permitidas, registrar respuesta de Google Vision, tiempo y error por etapa.
- [ ] **OCR-02 · Normalización y validación.** Extraer proveedor, NIT, factura, fecha, ítems, impuestos y totales; validar reglas contables antes de permitir el envío.
- [ ] **OCR-03 · Borrador con revisión humana.** Nunca contabilizar automáticamente; el usuario corrige y aprueba el payload antes de crear el documento en Siigo.
- [ ] **OCR-04 · Observabilidad.** Métricas de tasa de extracción, campos corregidos, errores y costo por documento.

## Plan de ejecución propuesto

### Fase 1 — Base segura y contrato de datos (semana 1)

1. Completar SEC-01, OPS-01 y DATA-01.
2. Definir DATA-02 con una tabla de propiedad de datos y resolución de conflictos.
3. Ejecutar SIG-01 y dejar un documento de contrato para cada recurso Siigo.

**Salida:** entorno seguro, modelo de sincronización aprobado y prueba autenticada contra Siigo.

### Fase 2 — Réplica operativa confiable (semanas 2–3)

1. Implementar SIG-02 y SIG-03 con sync manual administrable.
2. Construir SIG-04 y reconciliar datos con una muestra real.
3. Implementar JOB-01 a JOB-04.

**Salida:** clientes, productos, precios y stock disponibles en el panel, con actualización diaria y evidencia de cada corrida.

### Fase 3 — Operaciones bidireccionales (semanas 4–5)

1. Construir SIG-05, luego SIG-06 y SIG-07.
2. Definir y aprobar SIG-08 con contabilidad antes de automatizar facturas.
3. Realizar pruebas de duplicado, caída de red, reintento y conflicto de edición.

**Salida:** cambios del panel llegan a Siigo de forma auditable y recuperable.

### Fase 4 — Inteligencia comercial (semana 6)

1. Crear BI-01 y validar números contra Siigo.
2. Implementar BI-02 a BI-04.
3. Establecer un corte diario y métricas de calidad de datos.

**Salida:** tablero ejecutivo útil para operación, no solo visualmente atractivo.

### Fase 5 — Retomar OCR (después de la sincronización)

1. Resolver OCR-01 antes de cambiar proveedor o modelo.
2. Implementar OCR-02 y OCR-03 con revisión humana.
3. Medir OCR-04 durante un piloto controlado.

## Definición de terminado para cualquier tarea de integración

- Código revisado y sin secretos incorporados.
- Prueba con datos controlados y evidencia de éxito/error.
- Idempotencia: repetir la operación no duplica registros.
- Registro de auditoría con origen, destino, fecha, resultado e identificadores externos.
- Manejo de error, reintento y mensaje entendible para el usuario.
- Documentación de variables de entorno, despliegue y operación.

## Decisiones pendientes del negocio

1. ¿Siigo o el panel es la fuente de verdad para precio y stock?
2. ¿Qué cambios del panel necesitan aprobación humana antes de enviarse a Siigo?
3. ¿Qué indicadores exactos quiere gerencia y con qué frecuencia deben actualizarse?
4. ¿Qué tipo de facturas procesará el OCR: compras/proveedores, ventas o ambas?
