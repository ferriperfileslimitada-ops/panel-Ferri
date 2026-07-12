const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

const path = require('path');
const rateLimit = require('express-rate-limit');

app.use(cors());
app.use(express.json());

// Rate Limiter para el chat
const chatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 20, // 20 requests per windowMs
  message: { error: 'Demasiadas solicitudes. Por favor, espera un momento.' }
});

// Serve React static files from dist folder
app.use(express.static(path.join(__dirname, '../dist')));

const siigo = require('./siigo');
const chatRouter = require('./chat');
const productosRouter = require('./productos');
const clientesRouter = require('./clientes');
const siigoRoutes = require('./siigo-routes');

app.use('/api/chat', chatLimiter, chatRouter);
app.use('/api/productos', productosRouter);
app.use('/api/clientes', clientesRouter);
app.use('/api/siigo', siigoRoutes);


const transporter = nodemailer.createTransport({
  host: process.env.SMTP_ADDRESS || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.MAILER_SENDER_EMAIL || 'ferriperfileslimitada@gmail.com',
    pass: process.env.SMTP_PASSWORD || 'zuvnavosiwsiplgm',
  },
});

app.post('/api/send-quote', async (req, res) => {
  const { to, clientName, clientNit, date, quoteId, items, subtotal, iva, total, expiration, notes } = req.body;

  if (!to || !clientName || !items || !total) {
    return res.status(400).json({ error: 'Faltan datos obligatorios para el envío' });
  }

  const formatMoney = (amount) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(amount);
  };

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; color: #334155;">
      
      <!-- ENCABEZADO -->
      <div style="background-color: #f8fafc; padding: 30px; border-bottom: 2px solid #0f172a; display: flex; justify-content: space-between; align-items: flex-start;">
        <div style="flex: 1;">
          <h1 style="color: #0f172a; margin: 0; font-size: 24px;">FERRIPERFILES LIMITADA</h1>
          <p style="margin: 5px 0 2px 0; font-size: 13px;">NIT 900.133.263-6</p>
          <p style="margin: 0 0 2px 0; font-size: 13px;">CL 13 A 81 A 22</p>
          <p style="margin: 0 0 2px 0; font-size: 13px;">Tel: (6014122227) 3223797945 - Ext. 3142138977</p>
          <p style="margin: 0; font-size: 13px;">Bogotá - Colombia</p>
        </div>
        <div style="text-align: right; flex: 1;">
          <h2 style="margin: 0; color: #0f172a; font-size: 20px;">COTIZACIÓN OFICIAL</h2>
          <p style="margin: 5px 0 0 0; font-weight: bold; font-size: 16px;">#${quoteId || 'Reciente'}</p>
        </div>
      </div>

      <!-- DATOS DEL CLIENTE -->
      <div style="padding: 20px 30px; border-bottom: 1px solid #e2e8f0; background-color: #ffffff;">
        <table style="width: 100%; font-size: 14px;">
          <tr>
            <td style="width: 60%; vertical-align: top;">
              <p style="margin: 0 0 5px 0;"><strong style="color: #0f172a;">Señor(es):</strong> ${clientName}</p>
              <p style="margin: 0 0 5px 0;"><strong style="color: #0f172a;">NIT/Cédula:</strong> ${clientNit || 'N/A'}</p>
            </td>
            <td style="width: 40%; vertical-align: top; text-align: right;">
              <p style="margin: 0 0 5px 0;"><strong style="color: #0f172a;">Fecha:</strong> ${date || new Date().toLocaleDateString('es-CO')}</p>
              ${expiration ? `<p style="margin: 0; color: #ef4444;"><strong>Válida hasta:</strong> ${expiration}</p>` : ''}
            </td>
          </tr>
        </table>
      </div>

      <!-- CUERPO Y TABLA -->
      <div style="padding: 20px 30px;">
        ${notes ? `<p style="font-size: 14px; margin-bottom: 20px;"><strong>Notas Adicionales:</strong> ${notes}</p>` : ''}
        
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px; margin-bottom: 20px;">
          <thead>
            <tr style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0; text-align: left;">
              <th style="padding: 10px; color: #334155; font-size: 14px;">Descripción</th>
              <th style="padding: 10px; color: #334155; font-size: 14px; text-align: right;">Cant.</th>
              <th style="padding: 10px; color: #334155; font-size: 14px; text-align: right;">Precio Unit.</th>
              <th style="padding: 10px; color: #334155; font-size: 14px; text-align: right;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(item => `
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px; color: #475569; font-size: 14px;">${item.nombre}</td>
                <td style="padding: 10px; color: #475569; font-size: 14px; text-align: right;">${item.cantidad}</td>
                <td style="padding: 10px; color: #475569; font-size: 14px; text-align: right;">${formatMoney(item.precio_unitario)}</td>
                <td style="padding: 10px; color: #475569; font-size: 14px; text-align: right;">${formatMoney(item.subtotal)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div style="width: 100%; text-align: right; margin-top: 20px;">
          <p style="margin: 5px 0; color: #64748b; font-size: 14px;">Subtotal: <strong>${formatMoney(subtotal)}</strong></p>
          <p style="margin: 5px 0; color: #64748b; font-size: 14px;">IVA (19%): <strong>${formatMoney(iva)}</strong></p>
          <p style="margin: 10px 0 0 0; color: #0f172a; font-size: 18px; font-weight: bold;">Total a Pagar: ${formatMoney(total)}</p>
          ${expiration ? `<p style="margin-top: 15px; color: #ef4444; font-size: 12px;">Válida hasta: ${expiration}</p>` : ''}
        </div>
      </div>
      <div style="background-color: #f1f5f9; padding: 20px; text-align: center; color: #64748b; font-size: 12px;">
        <p style="margin: 0;">Gracias por preferir a Ferriperfiles Limitada.</p>
        <p style="margin: 5px 0 0 0;">Este correo es generado automáticamente. Si tienes dudas, contáctanos a ferriperfileslimitada@gmail.com.</p>
      </div>
    </div>
  `;

  try {
    const info = await transporter.sendMail({
      from: '"Ferriperfiles Limitada" <' + (process.env.MAILER_SENDER_EMAIL || 'ferriperfileslimitada@gmail.com') + '>',
      to: to,
      subject: `Cotización de Productos - Ferriperfiles Limitada`,
      html: htmlContent,
    });

    console.log("Mensaje enviado: %s", info.messageId);
    res.status(200).json({ success: true, messageId: info.messageId });
  } catch (error) {
    console.error("Error enviando correo:", error);
    res.status(500).json({ error: 'Ocurrió un error al enviar el correo' });
  }
});

// ─── ENDPOINT: Nuevo Despacho (Cotización Pagada) ───────────────────────────

app.post('/api/despacho-create', async (req, res) => {
  const { clienteEmail, clienteName, clienteNit, quoteId, quoteNumero, items, subtotal, iva, total, date, despachoId } = req.body;

  const formatMoney = (amount) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(amount);

  const itemsTableRows = (items || []).map(item => `
    <tr>
      <td style="padding:10px;border-bottom:1px solid #e2e8f0;color:#475569;font-size:14px;">${item.nombre}</td>
      <td style="padding:10px;border-bottom:1px solid #e2e8f0;color:#475569;font-size:14px;text-align:right;">${item.cantidad}</td>
      <td style="padding:10px;border-bottom:1px solid #e2e8f0;color:#475569;font-size:14px;text-align:right;">${formatMoney(item.precio_unitario)}</td>
      <td style="padding:10px;border-bottom:1px solid #e2e8f0;font-weight:bold;color:#0f172a;font-size:14px;text-align:right;">${formatMoney(item.subtotal)}</td>
    </tr>`).join('');

  // ── Correo 1: A Despachos (ferriperfiles@hotmail.com) ──────────────────────
  const htmlDespachos = `
  <div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;color:#334155;">
    <div style="background:linear-gradient(135deg,#1e3a5f,#2563eb);padding:30px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:26px;letter-spacing:1px;">🚀 NUEVO PEDIDO CONFIRMADO</h1>
      <p style="color:#bfdbfe;margin:8px 0 0;font-size:14px;">Pedido #${quoteNumero || quoteId} — ${date || new Date().toLocaleDateString('es-CO')}</p>
    </div>

    <div style="background:#fef9c3;border-left:5px solid #f59e0b;padding:20px 30px;margin:0;">
      <h2 style="color:#92400e;margin:0 0 12px;font-size:16px;">⚠️ ACCIONES REQUERIDAS — SIIGO Y DESPACHO</h2>
      <ol style="margin:0;padding-left:20px;color:#78350f;font-size:14px;line-height:2;">
        <li><strong>Ingresar a SIIGO</strong> y registrar la factura de venta para el cliente <strong>${clienteName}</strong> con NIT <strong>${clienteNit || 'N/A'}</strong>.</li>
        <li>Usar el número de cotización <strong>#${quoteNumero || quoteId}</strong> como referencia de la factura.</li>
        <li>El total a facturar es <strong>${formatMoney(total)}</strong> (incluye IVA del 19%).</li>
        <li>Una vez registrada la factura en SIIGO, <strong>enviarla al área de despachos</strong> para iniciar el alistamiento del pedido.</li>
        <li>Actualizar el estado del pedido en el <strong>Panel de Despachos</strong> a "En Alistamiento".</li>
      </ol>
    </div>

    <div style="padding:25px 30px;border-bottom:1px solid #e2e8f0;">
      <h3 style="color:#0f172a;margin:0 0 15px;font-size:15px;">📋 Información del Cliente</h3>
      <table style="width:100%;font-size:14px;">
        <tr><td style="padding:4px 0;color:#64748b;width:150px;">Cliente:</td><td style="font-weight:bold;color:#0f172a;">${clienteName}</td></tr>
        <tr><td style="padding:4px 0;color:#64748b;">NIT / Cédula:</td><td style="font-weight:bold;color:#0f172a;">${clienteNit || 'N/A'}</td></tr>
        <tr><td style="padding:4px 0;color:#64748b;">Correo:</td><td style="font-weight:bold;color:#0f172a;">${clienteEmail}</td></tr>
        <tr><td style="padding:4px 0;color:#64748b;">Fecha pedido:</td><td style="font-weight:bold;color:#0f172a;">${date || new Date().toLocaleDateString('es-CO')}</td></tr>
      </table>
    </div>

    <div style="padding:25px 30px;">
      <h3 style="color:#0f172a;margin:0 0 15px;font-size:15px;">📦 Detalle del Pedido</h3>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#f1f5f9;border-bottom:2px solid #e2e8f0;">
            <th style="padding:10px;text-align:left;font-size:13px;color:#475569;">Descripción</th>
            <th style="padding:10px;text-align:right;font-size:13px;color:#475569;">Cant.</th>
            <th style="padding:10px;text-align:right;font-size:13px;color:#475569;">Precio Unit.</th>
            <th style="padding:10px;text-align:right;font-size:13px;color:#475569;">Subtotal</th>
          </tr>
        </thead>
        <tbody>${itemsTableRows}</tbody>
      </table>
      <div style="text-align:right;margin-top:20px;border-top:1px solid #e2e8f0;padding-top:15px;">
        <p style="margin:4px 0;font-size:14px;color:#64748b;">Subtotal: <strong>${formatMoney(subtotal)}</strong></p>
        <p style="margin:4px 0;font-size:14px;color:#64748b;">IVA (19%): <strong>${formatMoney(iva)}</strong></p>
        <p style="margin:8px 0 0;font-size:20px;font-weight:bold;color:#1e3a5f;">Total: ${formatMoney(total)}</p>
      </div>
    </div>

    <div style="background:#f1f5f9;padding:15px 30px;text-align:center;font-size:12px;color:#64748b;">
      <p style="margin:0;">Panel Ferriperfiles · Pedido ID: ${despachoId || 'N/A'}</p>
    </div>
  </div>`;

  // ── Correo 2: Al Cliente (confirmación de pedido) ──────────────────────────
  const htmlCliente = `
  <div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;color:#334155;">
    <div style="background:linear-gradient(135deg,#065f46,#10b981);padding:30px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:26px;">✅ ¡Pedido Confirmado!</h1>
      <p style="color:#a7f3d0;margin:8px 0 0;font-size:14px;">Hemos recibido tu pago y ya estamos preparando tu pedido</p>
    </div>

    <div style="padding:25px 30px;background:#fff;">
      <p style="font-size:15px;color:#334155;">Hola <strong>${clienteName}</strong>,</p>
      <p style="font-size:14px;color:#475569;line-height:1.7;">Gracias por tu compra. Tu pedido <strong>#${quoteNumero || quoteId}</strong> ha sido confirmado y nuestro equipo ya está trabajando en él.</p>

      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;margin:20px 0;">
        <h3 style="color:#065f46;margin:0 0 12px;font-size:15px;">📋 Resumen de tu pedido</h3>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#dcfce7;"><th style="padding:8px;text-align:left;font-size:13px;color:#166534;">Producto</th><th style="padding:8px;text-align:right;font-size:13px;color:#166534;">Cant.</th><th style="padding:8px;text-align:right;font-size:13px;color:#166534;">Total</th></tr>
          </thead>
          <tbody>
            ${(items || []).map(i => `<tr><td style="padding:8px;font-size:13px;border-bottom:1px solid #bbf7d0;">${i.nombre}</td><td style="padding:8px;font-size:13px;text-align:right;border-bottom:1px solid #bbf7d0;">${i.cantidad}</td><td style="padding:8px;font-size:13px;text-align:right;border-bottom:1px solid #bbf7d0;font-weight:bold;">${formatMoney(i.subtotal)}</td></tr>`).join('')}
          </tbody>
        </table>
        <p style="text-align:right;font-size:18px;font-weight:bold;color:#065f46;margin:12px 0 0;">Total pagado: ${formatMoney(total)}</p>
      </div>

      <p style="font-size:14px;color:#475569;line-height:1.7;">Te mantendremos informado sobre el estado de tu pedido por este mismo correo. Si tienes alguna pregunta, escríbenos a <a href="mailto:ferriperfileslimitada@gmail.com" style="color:#2563eb;">ferriperfileslimitada@gmail.com</a>.</p>
    </div>

    <div style="background:#f1f5f9;padding:20px;text-align:center;color:#64748b;font-size:12px;">
      <p style="margin:0;font-weight:bold;color:#0f172a;">FERRIPERFILES LIMITADA</p>
      <p style="margin:4px 0;">NIT 900.133.263-6 · CL 13 A 81 A 22 · Tel: (601) 4122227</p>
      <p style="margin:0;">Bogotá - Colombia</p>
    </div>
  </div>`;

  try {
    // 1. Contabilidad (Facturación SIIGO)
    await transporter.sendMail({
      from: '"Ferriperfiles Limitada" <ferriperfileslimitada@gmail.com>',
      to: 'ferriperfiles@gmail.com',
      subject: `🚀 NUEVO PEDIDO #${quoteNumero || quoteId} — Acción requerida en SIIGO`,
      html: htmlDespachos, // Reusamos el html que ya tiene los detalles de siigo
    });

    // 2. Despachos
    await transporter.sendMail({
      from: '"Ferriperfiles Limitada" <ferriperfileslimitada@gmail.com>',
      to: 'ferriperfileslimitada@gmail.com',
      subject: `📦 ALISTAMIENTO DE PEDIDO #${quoteNumero || quoteId} — ${clienteName}`,
      html: htmlDespachos, // Enviamos los detalles del pedido también
    });

    // 3. Cliente
    await transporter.sendMail({
      from: '"Ferriperfiles Limitada" <ferriperfileslimitada@gmail.com>',
      to: clienteEmail,
      subject: `✅ Tu pedido #${quoteNumero || quoteId} fue confirmado — Ferriperfiles`,
      html: htmlCliente,
    });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error enviando correo de despacho:', error);
    res.status(500).json({ error: 'Error enviando correos de despacho' });
  }
});

// ─── ENDPOINT: Actualización de Estado de Despacho ──────────────────────────
app.post('/api/despacho-status', async (req, res) => {
  const { estado, clienteEmail, clienteName, quoteNumero, despachoId } = req.body;

  const estadoConfig = {
    en_alistamiento: {
      emoji: '📦',
      titulo: 'Tu pedido está siendo preparado',
      mensaje: 'Nuestro equipo de bodega está alistando cada uno de los productos de tu pedido con mucho cuidado.',
      color: '#f59e0b',
      gradiente: 'linear-gradient(135deg,#78350f,#f59e0b)',
      badge: 'EN ALISTAMIENTO',
    },
    en_cargue: {
      emoji: '🏗️',
      titulo: 'Tu pedido está siendo cargado',
      mensaje: 'Los productos han sido verificados y están siendo cargados en el vehículo de transporte.',
      color: '#3b82f6',
      gradiente: 'linear-gradient(135deg,#1e3a5f,#3b82f6)',
      badge: 'EN CARGUE',
    },
    en_transito: {
      emoji: '🚛',
      titulo: '¡Tu pedido está en camino!',
      mensaje: 'Tu pedido ya salió de nuestras instalaciones y está en ruta hacia tu destino. Pronto lo recibirás.',
      color: '#8b5cf6',
      gradiente: 'linear-gradient(135deg,#4c1d95,#8b5cf6)',
      badge: 'EN TRÁNSITO',
    },
    entregado: {
      emoji: '🎉',
      titulo: '¡Tu pedido fue entregado!',
      mensaje: 'Tu pedido ha sido entregado exitosamente. Esperamos que estés satisfecho con tu compra. ¡Gracias por confiar en Ferriperfiles!',
      color: '#10b981',
      gradiente: 'linear-gradient(135deg,#065f46,#10b981)',
      badge: 'ENTREGADO',
    },
  };

  const cfg = estadoConfig[estado] || estadoConfig['en_alistamiento'];

  const htmlStatus = `
  <div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;color:#334155;">
    <div style="background:${cfg.gradiente};padding:35px;text-align:center;">
      <div style="font-size:48px;margin-bottom:10px;">${cfg.emoji}</div>
      <h1 style="color:#fff;margin:0;font-size:24px;">${cfg.titulo}</h1>
      <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px;">Pedido #${quoteNumero || despachoId}</p>
    </div>

    <div style="padding:30px;">
      <p style="font-size:15px;">Hola <strong>${clienteName}</strong>,</p>
      <p style="font-size:14px;color:#475569;line-height:1.7;">${cfg.mensaje}</p>

      <div style="background:#f8fafc;border-radius:8px;padding:20px;margin:20px 0;text-align:center;">
        <p style="margin:0;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Estado actual</p>
        <div style="display:inline-block;background:${cfg.color};color:#fff;padding:8px 24px;border-radius:20px;font-weight:bold;font-size:14px;margin-top:8px;">${cfg.badge}</div>
      </div>

      ${estado === 'entregado' ? `
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;margin-top:20px;text-align:center;">
        <p style="color:#065f46;font-size:14px;margin:0;">¿Quedaste satisfecho con tu pedido? Tu opinión nos importa mucho.<br><strong>Escríbenos a ferriperfileslimitada@gmail.com</strong></p>
      </div>` : ''}

      <p style="font-size:13px;color:#94a3b8;margin-top:25px;">Si tienes alguna pregunta, contáctanos a <a href="mailto:ferriperfileslimitada@gmail.com" style="color:#2563eb;">ferriperfileslimitada@gmail.com</a> o al Tel: (601) 4122227.</p>
    </div>

    <div style="background:#f1f5f9;padding:20px;text-align:center;color:#64748b;font-size:12px;">
      <p style="margin:0;font-weight:bold;color:#0f172a;">FERRIPERFILES LIMITADA</p>
      <p style="margin:4px 0;">NIT 900.133.263-6 · CL 13 A 81 A 22 · Bogotá - Colombia</p>
    </div>
  </div>`;

  try {
    await transporter.sendMail({
      from: '"Ferriperfiles Limitada" <ferriperfileslimitada@gmail.com>',
      to: clienteEmail,
      subject: `${cfg.emoji} Tu pedido #${quoteNumero || despachoId} — ${cfg.badge} — Ferriperfiles`,
      html: htmlStatus,
    });
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error enviando correo de estado:', error);
    res.status(500).json({ error: 'Error enviando correo de estado' });
  }
});

// SIIGO ENDPOINTS

app.post('/api/siigo/customers', async (req, res) => {
  try {
    const data = await siigo.createSiigoCustomer(req.body);
    res.status(200).json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/siigo/customers/:id', async (req, res) => {
  try {
    const data = await siigo.updateSiigoCustomer(req.params.id, req.body);
    res.status(200).json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/siigo/quotations', async (req, res) => {
  try {
    const data = await siigo.createSiigoQuotation(req.body);
    res.status(200).json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/siigo/quotations/:id', async (req, res) => {
  try {
    const data = await siigo.updateSiigoQuotation(req.params.id, req.body);
    res.status(200).json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// ORBIT MCP ENDPOINTS

const orbitMcpClient = require('./orbit-mcp-client');

app.get('/api/integrations/orbit/health', async (req, res) => {
  try {
    const connectStatus = await orbitMcpClient.safeConnect();
    
    if (!connectStatus.success) {
      return res.status(502).json({ 
        connected: false, 
        error: connectStatus.error
      });
    }

    const tools = await orbitMcpClient.listTools();
    
    let sampleReceived = false;
    if (tools.find(t => t.name === 'siigo_list_products')) {
       try {
         const sample = await orbitMcpClient.callTool('siigo_list_products', { page: 1, page_size: 1 });
         if (sample) sampleReceived = true;
       } catch (err) {
         console.error('Test tool call failed', err);
       }
    }

    res.status(200).json({
      connected: true,
      toolsAvailable: tools.map(t => t.name),
      sampleReceived
    });
  } catch (error) {
    console.error('Orbit Health check failed', error);
    res.status(500).json({
      connected: false,
      error: 'Error interno conectando con Orbit MCP'
    });
  }
});

// React Router Fallback
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, '../dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor corriendo en http://0.0.0.0:${PORT}`);
});
