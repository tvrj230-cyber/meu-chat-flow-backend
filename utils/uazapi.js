const axios = require('axios');
require('dotenv').config();

const UAZAPI_TOKEN = process.env.UAZAPI_TOKEN || '';
const UAZAPI_INSTANCE = process.env.UAZAPI_INSTANCE || '1234';
const UAZAPI_SERVER = process.env.UAZAPI_SERVER_URL || 'https://api.uazapi.com';

// Pelo Erro 404, a rota base provavelmente é reta, sem /v1/instance/
const BASE_URL = UAZAPI_SERVER; 

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Authorization': `Bearer ${UAZAPI_TOKEN}`,
    'apikey': UAZAPI_TOKEN, // Vários serviços usam esse header
    'Content-Type': 'application/json'
  }
});

async function sendText(phone, text) {
  try {
    const res = await api.post('/send/text', {
      instance: UAZAPI_INSTANCE, // Alguns serviços exigem no body
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
    const formattedOptions = options.map((opt, i) => ({
      id: String(i + 1),
      title: opt
    }));

    const res = await api.post('/send/menu', {
      instance: UAZAPI_INSTANCE,
      number: phone,
      text: text,
      title: "Escolha uma opção",
      buttonText: "Opções", // Exigência de alguns provedores WhatsApp
      options: formattedOptions
    });
    console.log(`[UAZAPI] Menu enviado -> ${phone}`);
    return res.data;
  } catch (error) {
    console.error(`[UAZAPI ERRO Menu]`, error?.response?.data || error.message);
  }
}

module.exports = { sendText, sendMenu };
