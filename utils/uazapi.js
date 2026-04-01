const axios = require('axios');

const UAZAPI_SERVER = process.env.UAZAPI_SERVER_URL || 'https://api.uazapi.com';

// Função blindada que busca o token na hora (sem erro de cold-start)
async function buildHeaders() {
  const token = process.env.UAZAPI_TOKEN || '';
  return {
    'apikey': token,
    'Authorization': `Bearer ${token}`,
    'instance': process.env.UAZAPI_INSTANCE || '56mMDx', 
    'Content-Type': 'application/json'
  };
}

async function sendText(phone, text) {
  try {
    const headers = await buildHeaders();
    console.log(`[DEBUG] Rota Customizada UAZAPI. Token lido com sucesso (Tam: ${headers.apikey.length})`);
    
    // Voltando para a Rota original e Payload original que a Uazapi aceita
    const url = `${UAZAPI_SERVER}/send/text`;
    const payload = {
      instance: process.env.UAZAPI_INSTANCE,
      number: phone,
      text: text
    };

    const res = await axios.post(url, payload, { headers });
    console.log(`[UAZAPI Sucesso] Texto enviado -> ${phone}`);
    return res.data;
  } catch (error) {
     console.error(`[UAZAPI ERRO Txt]`, error?.response?.data || error.message);
  }
}

async function sendMenu(phone, text, options) {
  try {
    const headers = await buildHeaders();
    console.log(`[DEBUG] Disparando MENU.`);
    
    // Rota original de Menu customizada da UAZAPI
    const url = `${UAZAPI_SERVER}/send/menu`;
    const payload = {
      instance: process.env.UAZAPI_INSTANCE,
      number: phone,
      type: "button",
      text: text,
      choices: options
    };

    const res = await axios.post(url, payload, { headers });
    console.log(`[UAZAPI Sucesso] Menu enviado -> ${phone}`);
    return res.data;
  } catch (error) {
     console.error(`[UAZAPI ERRO Menu]`, error?.response?.data || error.message);
  }
}

module.exports = { sendText, sendMenu };
