const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

const path = require('path');

app.use(cors());
app.use(express.json());

// Serve React static files from dist folder
app.use(express.static(path.join(__dirname, '../dist')));

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

// React Router Fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor corriendo en http://0.0.0.0:${PORT}`);
});
