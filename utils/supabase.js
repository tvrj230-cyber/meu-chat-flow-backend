const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://fake.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'fake-key';
const supabase = createClient(supabaseUrl, supabaseKey);

// Busca o Lead no Banco de Dados para ver onde ele parou
async function getLeadState(phone, nome = "amigo(a)") {
  let { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('phone', phone)
    .single();

  if (!data) {
    const { data: newData, error: insertError } = await supabase
      .from('leads')
      .insert([{ nome, phone, whatsapp: phone, current_node: null }])
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

// Atualiza o estado da pessoa, anotando que horas isso aconteceu
async function updateLeadState(phone, nodeId, tag = null) {
  const updates = { 
    current_node: nodeId,
    updated_at: new Date().toISOString() // Hora exata de agora
  };
  
  const { error } = await supabase
    .from('leads')
    .update(updates)
    .eq('phone', phone);
  
  if (error) console.error("Erro ao atualizar lead:", error);
}

// Salva o e-mail coletado no CRM
async function updateLeadEmail(phone, email) {
  const updates = { 
    email: email,
    updated_at: new Date().toISOString()
  };
  
  const { error } = await supabase
    .from('leads')
    .update(updates)
    .eq('phone', phone);
  
  if (error) {
    console.error("Erro ao atualizar email do lead:", error);
    return false;
  }
  return true;
}

// Pesca leads que estão parados a mais de X horas no mesmo bloco
async function getStagnantLeads(hours) {
  const pastTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .neq('current_node', null)
    .lt('updated_at', pastTime); // A data salva é Menor (Mais antiga) do que o tempo limite

  if (error) {
    console.error("Erro ao buscar leads inativos:", error);
    return [];
  }
  return data || [];
}

// Busca o fluxo (mapa) do banco de dados
async function getBotFlow() {
  const { data, error } = await supabase
    .from('flows')
    .select('flow_data')
    .eq('id', 'default')
    .single();
    
  if (error || !data) {
    console.error("Erro ao buscar o webhook/fluxo do Supabase:", error);
    return null;
  }
  return data.flow_data;
}

module.exports = { getLeadState, updateLeadState, updateLeadEmail, getBotFlow, getStagnantLeads, supabase };
