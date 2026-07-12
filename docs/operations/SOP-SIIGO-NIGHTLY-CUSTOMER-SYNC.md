# SOP operativo — sincronización nocturna de clientes Siigo

Siigo es la fuente de verdad de los clientes. Supabase conserva una réplica operativa y nunca reutiliza el UUID local con el UUID externo de Siigo.

La migración `007_atomic_siigo_customer_sync.sql` instala `sync_siigo_cliente(...)`. Solo `service_role` puede ejecutarla. El proceso:

1. Pagina `GET /v1/customers` y consulta el detalle de cada cliente.
2. Rechaza y audita clientes sin identificación o sin nombre, sin crear valores de reemplazo.
3. Crea o actualiza atómicamente por `clientes.identification`.
4. Conserva `clientes.id` como identidad local y guarda el ID de Siigo en `siigo_entity_map`.
5. Rechaza una reasignación de un mapa Siigo a otro cliente; requiere revisión manual.

Las incidencias quedan en `siigo_sync_issues` con `entity_type = 'customer'`; las ejecuciones se auditan en `siigo_sync_runs`. La tarea programada se ejecuta a las 00:30, después del catálogo de productos, usando `SUPABASE_SERVICE_ROLE_KEY` exclusivamente en el servidor.
