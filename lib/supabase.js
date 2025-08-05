const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('=== SUPABASE CONFIGURATION ===');
console.log('SUPABASE_URL:', supabaseUrl ? 'Set' : 'Missing');
console.log('SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? 'Set' : 'Missing');

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  throw new Error('Missing Supabase environment variables');
}

console.log('✅ Supabase environment variables are set');

const supabase = createClient(supabaseUrl, supabaseKey);

// Test connection
supabase.from('conversations').select('count').limit(1)
  .then(() => {
    console.log('✅ Supabase connection test successful');
  })
  .catch((error) => {
    console.error('❌ Supabase connection test failed:', error.message);
  });

module.exports = supabase; 