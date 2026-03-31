const axios = require('axios');
require('dotenv').config();

const UAZAPI_TOKEN = process.env.UAZAPI_TOKEN || '';
const UAZAPI_INSTANCE = process.env.UAZAPI_INSTANCE || '1234';
const UAZAPI_SERVER = process.env.UAZAPI_SERVER_URL || 'https://api.uazapi.com';

// A documentação sempre usa a estrutura /v1/instance/{NOME} como base de injeção!
const BASE_URL = `${UAZAPI_SERVER}/v1/instance/${UAZAPI_INSTANCE}`;

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Authorization': `Bearer ${UAZAPI_TOKEN}`,
    'apikey': UAZAPI_TOKEN,
    'Content-Type': 'application/json'
  }
});

async function sendText(phone, text) {
  try {
    const res = await api.post('/send/text', {
      number: phone,
      text: text
    });
    console.log(`[UAZAPI] Texto enviado -> ${phone}`);
    return res.data;
  } catch (error) {
    console.error(`[UAZAPI ERRO Txt]`, error?.response?.data || error.message);
  }
}

async function sendMenu(phone, text, options) {
  try {
    // Agora usando EXATAMENTE o schema genial que você mandou da documentação:
    const res = await api.post('/send/menu', {
      number: phone,
      type: "button",
      text: text,
      choices: options
    });
    console.log(`[UAZAPI] Menu enviado -> ${phone}`);
    return res.data;
  } catch (error) {
    console.error(`[UAZAPI ERRO Menu]`, error?.response?.data || error.message);
  }
}

module.exports = { sendText, sendMenu };
