const axios = require('axios');
require('dotenv').config();

const UAZAPI_TOKEN = process.env.UAZAPI_TOKEN || '';
const UAZAPI_INSTANCE = process.env.UAZAPI_INSTANCE || '1234';
const BASE_URL = `https://api.uazapi.com/v1/instance/${UAZAPI_INSTANCE}`;

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Authorization': `Bearer ${UAZAPI_TOKEN}`,
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
    // Formata do jeito estrito que a rota /send/menu exige
    const formattedOptions = options.map((opt, i) => ({
      id: String(i + 1),
      title: opt
    }));

    const res = await api.post('/send/menu', {
      number: phone,
      text: text,
      options: formattedOptions
    });
    console.log(`[UAZAPI] Menu enviado -> ${phone}`);
    return res.data;
  } catch (error) {
    console.error(`[UAZAPI ERRO Menu]`, error?.response?.data || error.message);
  }
}

module.exports = { sendText, sendMenu };
