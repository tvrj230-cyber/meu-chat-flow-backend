const axios = require('axios');

const UAZAPI_TOKEN = process.env.UAZAPI_TOKEN || '';
const UAZAPI_INSTANCE = process.env.UAZAPI_INSTANCE || '';
const UAZAPI_SERVER = process.env.UAZAPI_SERVER_URL || 'https://api.uazapi.com';

// Monta as requisições de forma limpa, garantindo a injeção em tempo real!
async function buildHeaders() {
  return {
    'apikey': process.env.UAZAPI_TOKEN,
    'Content-Type': 'application/json'
  };
}

async function sendText(phone, text) {
  try {
    const headers = await buildHeaders();
    console.log(`[DEBUG] Disparando Txt. APIKEY tem: ${headers.apikey ? headers.apikey.length : 0} caracteres.`);
    
    // Rota no padrão puro da Evolution API (UAZAPI V2)
    const url = `${UAZAPI_SERVER}/message/sendText/${UAZAPI_INSTANCE}`;
    const payload = {
      number: phone,
      options: { delay: 1200 },
      textMessage: { text: text }
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
    const url = `${UAZAPI_SERVER}/message/sendText/${UAZAPI_INSTANCE}`;
    
    const menuBody = text + '\n\n' + options.map((opt, i) => `${i+1} - ${opt}`).join('\n');
    
    const payload = {
      number: phone,
      options: { delay: 1200 },
      textMessage: { text: menuBody }
    };

    const res = await axios.post(url, payload, { headers });
    console.log(`[UAZAPI Sucesso] Menu enviado -> ${phone}`);
    return res.data;
  } catch (error) {
     console.error(`[UAZAPI ERRO Menu]`, error?.response?.data || error.message);
  }
}

module.exports = { sendText, sendMenu };
