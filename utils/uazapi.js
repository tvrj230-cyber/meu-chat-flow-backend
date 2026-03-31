const axios = require('axios');
require('dotenv').config();

const UAZAPI_TOKEN = process.env.UAZAPI_TOKEN || '';
const UAZAPI_SERVER = process.env.UAZAPI_SERVER_URL || 'https://api.uazapi.com';

const api = axios.create({
  baseURL: UAZAPI_SERVER,
  headers: {
    'Authorization': `Bearer ${UAZAPI_TOKEN}`,
    'apikey': UAZAPI_TOKEN,
    'Content-Type': 'application/json'
  }
});

async function sendText(phone, text) {
  try {
    const res = await api.post('/send/text', { number: phone, text: text });
    return res.data;
  } catch (error) { console.error(`[UAZAPI ERRO Txt]`, error?.message); }
}

async function sendMenu(phone, text, options) {
  try {
    const res = await api.post('/send/menu', {
      number: phone,
      type: "button",
      text: text,
      choices: options
    });
    return res.data;
  } catch (error) { console.error(`[UAZAPI ERRO Menu]`, error?.response?.data || error.message); }
}

module.exports = { sendText, sendMenu };
