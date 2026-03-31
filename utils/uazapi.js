const axios = require('axios');
require('dotenv').config();

const UAZAPI_TOKEN = process.env.UAZAPI_TOKEN || '';
const UAZAPI_INSTANCE = process.env.UAZAPI_INSTANCE || '1234';
// Removemos qualquer barra final pra garantir que não quebre a URL
let UAZAPI_SERVER = (process.env.UAZAPI_SERVER_URL || 'https://api.uazapi.com').replace(/\/$/, '');

// Configuração Absoluta de Headers (Para o Servidor não barrar nosso Token)
const uazapiHeaders = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'apikey': UAZAPI_TOKEN,
    'Authorization': `Bearer ${UAZAPI_TOKEN}`, 
    'instance': UAZAPI_INSTANCE // A magia de identificar qual Zap estamos usando!
};

async function sendText(phone, text) {
  try {
    // URL Absoluta
    const url = `${UAZAPI_SERVER}/send/text`;
    const res = await axios.post(url, { number: phone, text: text }, { headers: uazapiHeaders });
    return res.data;
  } catch (error) { 
    console.error(`[UAZAPI ERRO Txt]`, error?.message); 
  }
}

async function sendMenu(phone, text, options) {
  try {
    // URL Absoluta baseada no seu cURL
    const url = `${UAZAPI_SERVER}/send/menu`;
    
    const payload = {
      number: phone,
      type: "list", // Usando o formato 'Lista' exatamente como na documentação
      text: text,
      footerText: "Mais opções",
      listButton: "Exibir opções",
      selectableCount: 1,
      choices: options
    };

    const res = await axios.post(url, payload, { headers: uazapiHeaders });
    return res.data;
  } catch (error) { 
    console.error(`[UAZAPI ERRO Menu]`, error?.response?.data || error.message); 
  }
}

module.exports = { sendText, sendMenu };
