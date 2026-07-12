const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { createSiigoCustomer, updateSiigoCustomer } = require('./siigo');

const router = express.Router();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY);

router.post('/', async (req, res) => {
  try {
    const clientData = req.body;
    let siigoId = null;

    // 1. Create in Siigo
    try {
      const siigoRes = await createSiigoCustomer({
        type: clientData.tipo === 'Empresa' ? 'Company' : 'Person',
        person_type: clientData.tipo === 'Empresa' ? 'Company' : 'Person',
        id_type: clientData.tipo === 'Empresa' ? '31' : '13',
        identification: clientData.identification,
        name: [clientData.name],
        commercial_name: clientData.name,
        branch_office: 0,
        active: true,
        vat_responsible: false,
        fiscal_responsibilities: [{ code: 'R-99-PN' }],
        address: {
          address: clientData.address,
          city: { city_code: "11001", state_code: "11" } // Default Bogotá
        },
        phones: [{ number: clientData.Telefono }],
        contacts: [{
          first_name: clientData.contact_name || clientData.name,
          last_name: "",
          email: clientData.email,
          phone: { number: clientData.Telefono }
        }]
      });
      siigoId = siigoRes.id;
    } catch (e) {
      console.warn("Could not create customer in Siigo:", e.message);
    }

    // 2. Create in Supabase
    const { data, error } = await supabase
      .from('clientes')
      .insert([{ ...clientData, siigo_id: siigoId }])
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
    const { id } = req.params; // Supabase ID
    const clientData = req.body;

    // 1. Fetch current client to get siigo_id
    const { data: currentClient } = await supabase.from('clientes').select('*').eq('id', id).single();
    if (!currentClient) {
      return res.status(404).json({ error: "Cliente no encontrado." });
    }

    // 2. Update Siigo
    if (currentClient.siigo_id) {
      try {
        await updateSiigoCustomer(currentClient.siigo_id, {
          name: [clientData.name || currentClient.name],
          commercial_name: clientData.name || currentClient.name,
          address: {
            address: clientData.address || currentClient.address,
            city: { city_code: "11001", state_code: "11" }
          },
          phones: [{ number: clientData.Telefono || currentClient.Telefono }],
          contacts: [{
            first_name: clientData.contact_name || currentClient.contact_name || clientData.name || currentClient.name,
            last_name: "",
            email: clientData.email || currentClient.email,
            phone: { number: clientData.Telefono || currentClient.Telefono }
          }]
        });
      } catch (e) {
        console.warn("Could not update customer in Siigo:", e.message);
      }
    }

    // 3. Update Supabase
    const { data, error } = await supabase
      .from('clientes')
      .update(clientData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
