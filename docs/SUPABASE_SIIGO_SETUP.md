# Guía simple — Preparar Supabase para Siigo

Esta guía crea solo tablas de control. No cambia productos, clientes, precios, inventario ni facturas existentes.

## Antes de empezar

1. Entra al panel administrativo de tu Supabase autoalojado.
2. Haz un respaldo de la base de datos desde tu servidor. Si no tienes un respaldo reciente, no continúes.
3. Rota la clave administrativa de Supabase porque una versión anterior quedó escrita en un script local. La nueva clave debe vivir solo en `.env` o en el gestor de secretos de tu servidor.
4. Abre el archivo `.env` del proyecto y añade la nueva clave así:

   ```env
   SUPABASE_SERVICE_ROLE_KEY=PEGA_AQUI_LA_NUEVA_CLAVE
   ```

   Nunca pegues esa clave en el chat, en GitHub o en el frontend.

## Si Supabase corre en Dokploy

### Paso A — Identificar el tipo de despliegue

1. En Dokploy, abre el proyecto donde está Supabase.
2. Revisa cómo aparece el servicio:
   - **Database → PostgreSQL:** Dokploy administra la base directamente.
   - **Docker Compose:** Supabase completo está desplegado como varios contenedores.
3. No copies valores de variables. Solo identifica el tipo de servicio y los nombres de estas variables si existen: `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`, `SUPABASE_PUBLISHABLE_KEY` y `SUPABASE_SECRET_KEY`.

### Paso B — Crear un respaldo comprobable

- Si aparece como **Database → PostgreSQL**, abre la pestaña **Backup**, configura un destino S3 si aún no existe y usa **Test**. Confirma que el archivo llegó al destino antes de seguir.
- Si aparece como **Docker Compose**, no uses el respaldo global de Dokploy como sustituto de una copia de la base de Supabase. Primero localiza el servicio PostgreSQL dentro del Compose y crea un respaldo de esa base; pide ayuda antes de ejecutar comandos si no sabes cuál es el contenedor.

#### Respaldo para esta instalación

En esta instalación el servicio PostgreSQL se llama `db`. Conéctate por SSH al servidor y ejecuta estos comandos uno por uno:

```bash
docker ps --format 'table {{.Names}}\t{{.Image}}' | grep 'supabase/postgres'
```

El comando mostrará el nombre real del contenedor. Cópialo y reemplaza `NOMBRE_DEL_CONTENEDOR` en los siguientes comandos:

```bash
mkdir -p ~/backups
docker exec NOMBRE_DEL_CONTENEDOR sh -lc 'pg_dump -U postgres -d "$PGDATABASE" -Fc' > ~/backups/supabase-before-siigo-$(date +%F-%H%M).dump
ls -lh ~/backups/
```

El último comando debe mostrar un archivo `.dump` con un tamaño mayor que cero. Para comprobar que el archivo es legible, usa:

```bash
docker exec -i NOMBRE_DEL_CONTENEDOR pg_restore -l < ~/backups/NOMBRE_DEL_ARCHIVO.dump | head
```

Si ves una lista de objetos de PostgreSQL, el respaldo está correcto.

### Paso C — Rotar la clave con cuidado

No cambies `JWT_SECRET` a ciegas: puede cerrar sesiones y afectar servicios internos. Primero identificaremos si tu instalación usa las claves nuevas (`SUPABASE_SECRET_KEY`) o las claves antiguas (`SERVICE_ROLE_KEY`). Luego cambiaremos una sola clave de servidor, actualizaremos los servicios que la usan y haremos un redeploy controlado.

## Aplicar la migración

1. En Supabase Studio, abre **SQL Editor**.
2. Crea una consulta nueva.
3. Abre este archivo local:

   `supabase/migrations/002_siigo_integration_foundation.sql`

4. Copia todo su contenido en el editor SQL.
5. Pulsa **Run**.

## Qué debe pasar

Supabase debe crear cinco tablas nuevas:

- `siigo_sync_runs`: historial de cada sincronización.
- `siigo_entity_map`: relación entre un registro local y su ID de Siigo.
- `siigo_webhook_events`: mensajes recibidos desde Siigo, sin duplicados.
- `integration_outbox`: cambios que el panel quiere enviar a Siigo.
- `integration_dead_letters`: errores que requieren revisión humana.

No verás cambios en las pantallas del panel todavía; estas tablas son la base de seguridad para construir la sincronización.

## Comprobación final

Ejecuta esta consulta en SQL Editor:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'siigo_sync_runs',
    'siigo_entity_map',
    'siigo_webhook_events',
    'integration_outbox',
    'integration_dead_letters'
  )
order by table_name;
```

Debes ver las cinco tablas. Si aparece un error, toma una captura que no muestre claves y compártela aquí.
