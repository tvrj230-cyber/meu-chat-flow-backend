const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://fake.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'fake-key';
const supabase = createClient(supabaseUrl, supabaseKey);

// Busca o Lead no Banco de Dados para ver onde ele parou
async function getLeadState(phone) {
  let { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('phone', phone)
    .single();

  if (!data) {
    // Lead Novo: Insere ele e deixa current_node vazio
    const { data: newData, error: insertError } = await supabase
      .from('leads')
      .insert([{ phone, current_node: null }])
      .select()
      .single();
    if (insertError) {
      console.error("Erro ao criar lead:", insertError);
      return null;
    }
    return newData;
  }
  return data;
}

// Atualiza o estado ou insere uma TAG da Fase 1
async function updateLeadState(phone, nodeId, tag = null) {
  const updates = { current_node: nodeId };
  
  // Se o nó for um TagNode, a gente pode atualizar outra coluna, mas vamos salvar
  // a lógia aqui flexível o suficiente.

  const { error } = await supabase
    .from('leads')
    .update(updates)
    .eq('phone', phone);
  
  if (error) console.error("Erro ao atualizar lead:", error);
}

module.exports = { getLeadState, updateLeadState, supabase };
