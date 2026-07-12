const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const logFilePath = path.join(__dirname, 'logs.json');

// Memory cache of logs
let memoryLogs = [];

// Load existing logs if file exists
try {
  if (fs.existsSync(logFilePath)) {
    const fileContent = fs.readFileSync(logFilePath, 'utf8');
    memoryLogs = JSON.parse(fileContent);
  }
} catch (err) {
  console.error('Failed to load logs from file', err);
}

// Mail transporter configuration
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_ADDRESS || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.MAILER_SENDER_EMAIL || 'ferriperfileslimitada@gmail.com',
    pass: process.env.SMTP_PASSWORD || 'zuvnavosiwsiplgm',
  },
});

async function sendErrorEmailAlert(service, message, details) {
  const mailOptions = {
    from: `"Alertas Ferriperfiles" <${process.env.MAILER_SENDER_EMAIL || 'ferriperfileslimitada@gmail.com'}>`,
    to: 'agency.adsbigger@gmail.com',
    subject: `🚨 ERROR EN SISTEMA: [${service}]`,
    html: `
      <div style="font-family: sans-serif; padding: 20px; max-width: 600px; border: 1px solid #f1f5f9; border-radius: 8px;">
        <h2 style="color: #ef4444; margin-top: 0;">Alerta de Error Detectada</h2>
        <p>Se ha registrado un fallo en el panel administrativo de Ferriperfiles.</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
          <tr>
            <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #f1f5f9; width: 120px;">Servicio:</td>
            <td style="padding: 8px; border-bottom: 1px solid #f1f5f9;">${service}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #f1f5f9;">Mensaje:</td>
            <td style="padding: 8px; border-bottom: 1px solid #f1f5f9; color: #ef4444;">${message}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #f1f5f9;">Fecha (UTC):</td>
            <td style="padding: 8px; border-bottom: 1px solid #f1f5f9;">${new Date().toISOString()}</td>
          </tr>
        </table>
        ${details ? `
        <div style="margin-top: 20px;">
          <h4 style="margin-bottom: 5px;">Detalles Técnicos:</h4>
          <pre style="background-color: #f8fafc; padding: 12px; border-radius: 6px; font-size: 13px; overflow-x: auto;">${typeof details === 'object' ? JSON.stringify(details, null, 2) : details}</pre>
        </div>` : ''}
        <p style="margin-top: 20px; font-size: 12px; color: #64748b; border-top: 1px solid #f1f5f9; padding-top: 15px;">
          Este es un correo automático generado por el Panel de Ferriperfiles Dashboard.
        </p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Error email alert sent successfully for ${service}`);
  } catch (err) {
    console.error('Failed to send error email alert:', err.message || err);
  }
}

function logError(service, message, details = null) {
  const newLog = {
    id: Date.now().toString() + Math.random().toString(36).substring(2, 5),
    timestamp: new Date().toISOString(),
    service,
    message,
    details
  };

  // Add to memory
  memoryLogs.unshift(newLog);
  
  // Keep last 500 items
  if (memoryLogs.length > 500) {
    memoryLogs = memoryLogs.slice(0, 500);
  }

  // Persist to file
  try {
    fs.writeFileSync(logFilePath, JSON.stringify(memoryLogs, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write logs to file', err);
  }

  // Trigger async email alert
  sendErrorEmailAlert(service, message, details);
}

function getLogs() {
  return memoryLogs;
}

function clearLogs() {
  memoryLogs = [];
  try {
    fs.writeFileSync(logFilePath, JSON.stringify([], null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to clear logs file', err);
  }
}

module.exports = {
  logError,
  getLogs,
  clearLogs
};
