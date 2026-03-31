const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://fake.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'fake-key';
const supabase = createClient(supabaseUrl, supabaseKey);

async function getLeadState(phone) {
  let { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('phone', phone)
    .single();

  if (!data) {
    // Forçamos a coluna whatsapp pra não bater na trava do banco de dados!
    const { data: newData, error: insertError } = await supabase
      .from('leads')
      .insert([{ phone, whatsapp: phone, current_node: null }])
      .select()
      .single();
    if (insertError) return null;
    return newData;
  }
  return data;
}

async function updateLeadState(phone, nodeId, tag = null) {
  const updates = { current_node: nodeId };
  const { error } = await supabase.from('leads').update(updates).eq('phone', phone);
}

module.exports = { getLeadState, updateLeadState, supabase };
