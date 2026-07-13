const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { updateSiigoProduct, createSiigoProduct, createSiigoInventoryAdjustment } = require('./siigo');
const nodemailer = require('nodemailer');

const router = express.Router();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY);

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_ADDRESS || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.MAILER_SENDER_EMAIL || 'ferriperfileslimitada@gmail.com',
    pass: process.env.SMTP_PASSWORD,
  },
});

router.post('/', async (req, res) => {
  try {
    const productData = req.body;
    let siigoId = null;

    // 1. Create in Siigo
    try {
      const siigoRes = await createSiigoProduct({
        code: productData.sku,
        name: productData.nombre,
        account_group: 1, // Default or require mapping
        type: "Product",
        stock_control: true,
        tax_classification: "Taxed",
        prices: [{ currency_code: "COP", price_list: [{ position: 1, value: productData.precio }] }]
      });
      siigoId = siigoRes.id;
    } catch (e) {
      console.warn("Could not create product in Siigo:", e.message);
    }

    // 2. Create in Supabase
    // Map sku to code as per Supabase schema
    const { sku, sligo_id, ...restProductData } = productData;
    const { data, error } = await supabase
      .from('productos')
      .insert([{ ...restProductData, code: sku, sligo_id: siigoId }]) 
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params; // This is now the supa_id
    const { stock, precio } = req.body;

    // 1. Fetch current product from Supabase to check previous stock and get sligo_id
    const { data: currentProduct } = await supabase.from('productos').select('*').eq('supa_id', id).single();
    if (!currentProduct) {
      return res.status(404).json({ error: "Producto no encontrado en la base de datos local." });
    }
    const siigoId = currentProduct.sligo_id;

    // 2. Update Siigo Price if changed
    if (precio !== undefined && precio !== currentProduct.precio && siigoId) {
      try {
        await updateSiigoProduct(siigoId, {
          prices: [{ currency_code: "COP", price_list: [{ position: 1, value: precio }] }]
        });
      } catch (e) {
        console.warn("Could not update price in Siigo:", e.message);
      }
    }

    // 3. Update Siigo Stock (Inventory Adjustment) if changed
    if (stock !== undefined && stock !== currentProduct.stock && siigoId) {
      const diff = stock - currentProduct.stock;
      try {
        // Attempt inventory adjustment. Note: This assumes Document Type 99 exists for adjustments.
        // It might fail if Siigo account isn't configured, so we wrap it.
        const date = new Date().toISOString().split('T')[0];
        await createSiigoInventoryAdjustment({
          document: { id: 25 }, // ID of voucher document type in Siigo (depends on account)
          date: date,
          items: [{
            product: { id: siigoId },
            description: "Ajuste manual desde panel",
            quantity: diff,
            value: precio || currentProduct.precio
          }]
        });

        // Enviar correo de notificación
        await transporter.sendMail({
          from: process.env.MAILER_SENDER_EMAIL || 'ferriperfileslimitada@gmail.com',
          to: 'ferriperfiles@hotmail.com, agency.bigger@gmail.com',
          subject: '⚠️ Ajuste de Inventario Manual (Ferriperfiles)',
          html: `<p>Se ha modificado el stock del producto <b>${currentProduct.nombre}</b> (SKU: ${currentProduct.sku}).</p>
                 <p>Stock anterior: ${currentProduct.stock}</p>
                 <p>Nuevo stock: ${stock}</p>
                 <p>Diferencia: ${diff > 0 ? '+'+diff : diff}</p>`
        });

      } catch (e) {
        console.warn("Could not create inventory adjustment in Siigo:", e.message);
        // Fallback email in case of Siigo API error but we still update local
        await transporter.sendMail({
          from: process.env.MAILER_SENDER_EMAIL || 'ferriperfileslimitada@gmail.com',
          to: 'ferriperfiles@hotmail.com, agency.bigger@gmail.com',
          subject: '⚠️ Ajuste de Inventario Manual - Error Siigo',
          html: `<p>Se ha modificado el stock del producto <b>${currentProduct.nombre}</b> pero <b>falló</b> la sincronización con Siigo: ${e.message}</p>
                 <p>Por favor revise Siigo manualmente.</p>`
        });
      }
    }

    // 4. Update Supabase
    const updates = {};
    if (stock !== undefined) updates.stock = stock;
    if (precio !== undefined) updates.precio = precio;

    const { data, error } = await supabase
      .from('productos')
      .update(updates)
      .eq('supa_id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
