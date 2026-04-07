import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.PUBLIC_SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');
async function run() {
  const { data: users } = await supabase.auth.admin.listUsers();
  const user = users.users.find(u => u.email === 'marcel.murschel@googlemail.com');
  if (!user) { console.log('User not found'); return; }
  console.log('User ID:', user.id);
  const { data: purchases } = await supabase.from('purchases').select('*').eq('user_id', user.id);
  console.log('Purchases:', purchases);
  
  // Also list all stripe invoices just to see without email filter
  // wait we already saw stripe only has 1 invoice for this email.
}
run().catch(console.error);
