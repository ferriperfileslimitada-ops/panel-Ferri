# Siigo API - Documentación

Siigo API permite integrar aplicaciones a Siigo Nube para automatizar el ciclo de venta e información contable mediante una Interfaz de Programación de Aplicaciones (API).

## Enlaces Oficiales
- **Portal de Clientes Siigo (Información general)**: https://siigonube.portaldeclientes.siigo.com/informacion-siigo-api/
- **Portal de Desarrolladores (Endpoints y Guías)**: https://developers.siigo.com/docs/siigoapi/
- **Referencia Técnica (Swagger/Apiary)**: https://siigoapi.docs.apiary.io/#
- **Soporte API**: soporteapi@siigo.com

## Casos de Uso Comunes (¿Necesitas Siigo API?)
- Enviar facturas electrónicas.
- Sincronizar productos e inventarios.
- Gestionar terceros (clientes y proveedores).
- Automatizar el envío de comprobantes contables y recibos.

## Endpoints y Recursos Principales

| Recurso | Endpoint | Descripción |
|---------|----------|-------------|
| **Productos o servicios** | `/products` | Crear, consultar, actualizar y borrar productos. |
| **Clientes (Terceros)** | `/customers` | Crear, consultar y actualizar clientes / terceros. |
| **Facturas de venta** | `/invoices` | Crear, editar, enviar por mail, anular, borrar o consultar facturas de venta y su PDF. |
| **Facturas de Compra** | `/purchases` | Crear, editar, eliminar y consultar facturas de compra. |
| **Notas crédito** | `/credit-notes` | Crear, consultar notas crédito y su PDF. |
| **Recibos de caja** | `/vouchers` | Crear y consultar recibos de caja. |
| **Recibos de pago/egreso** | `/payment-receipts` | Crear, editar, eliminar y consultar recibos de pago/egreso. |
| **Comprobantes contables** | `/journals` | Crear y consultar comprobantes contables. |
| **Reportes financieros** | *(Varios)* | Consultar balances de prueba, balances por tercero y cuentas por pagar. |
| **Cotizaciones** | `/quotations` | Crear, consultar, actualizar y borrar cotizaciones. |
| **Documento soporte** | `/purchase-support-documents` | Crear, editar, eliminar y consultar documentos soporte. |

## Credenciales Requeridas
Para poder conectarse y operar sobre la API de Siigo, es necesario enviar las credenciales en los encabezados (headers) de autenticación:
- `Partner-Id`
- Token de autenticación (generado con `SIIGO_USERNAME` y `SIIGO_API_KEY`).
