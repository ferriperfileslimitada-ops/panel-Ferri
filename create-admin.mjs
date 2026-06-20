import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://supabase.ferriperfiles.com';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NjMwODk3MTcsImV4cCI6MTg5MzQ1NjAwMCwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlzcyI6InN1cGFiYXNlIn0.NHDBLZCr12t_QN2ySG2zicMBFXRkh0f46ENKlenChCo';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function createAdmin() {
  const email = 'admin@ferriperfiles.com';
  const password = 'AdminPassword123!';

  console.log('Checking for existing users...');
  const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers();
  
  if (listErr) {
    console.error('Error listing users:', listErr.message);
    return;
  }

  const existingUser = users.find(u => u.email === email);

  if (existingUser) {
    console.log(`User ${email} already exists. Updating password...`);
    const { error: updateErr } = await supabase.auth.admin.updateUserById(existingUser.id, {
      password: password,
      email_confirm: true
    });
    
    if (updateErr) {
      console.error('Error updating password:', updateErr.message);
    } else {
      console.log('Password updated successfully!');
    }
  } else {
    console.log(`Creating new user ${email}...`);
    const { data, error } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true
    });

    if (error) {
      console.error('Error creating user:', error.message);
    } else {
      console.log('User created successfully:', data.user.id);
    }
  }
}

createAdmin().catch(console.error);
