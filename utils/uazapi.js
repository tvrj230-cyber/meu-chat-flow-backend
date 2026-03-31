const axios = require('axios');
require('dotenv').config();

const UAZAPI_TOKEN = process.env.UAZAPI_TOKEN || '';
const UAZAPI_INSTANCE = process.env.UAZAPI_INSTANCE || '1234';
let UAZAPI_SERVER = (process.env.UAZAPI_SERVER_URL || 'https://api.uazapi.com').replace(/\/$/, '');

// A Chave Mágica Descoberta: Eles exigem a palavra 'token'!
const uazapiHeaders = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'token': UAZAPI_TOKEN,
    'apikey': UAZAPI_TOKEN,
    'Authorization': `Bearer ${UAZAPI_TOKEN}` 
};

async function sendText(phone, text) {
  try {
    const url = `${UAZAPI_SERVER}/send/text`;
    const res = await axios.post(url, { number: phone, text: text }, { headers: uazapiHeaders });
    return res.data;
  } catch (error) { 
    console.error(`[UAZAPI ERRO Txt]`, error?.message); 
  }
}

async function sendMenu(phone, text, options) {
  try {
    const url = `${UAZAPI_SERVER}/send/menu`;
    const payload = {
      number: phone,
      type: "list",
      text: text,
      footerText: "Mais opções",
      listButton: "Exibir opções",
      selectableCount: 1,
      choices: options
    };

    const res = await axios.post(url, payload, { headers: uazapiHeaders });
    return res.data;
  } catch (error) { 
        console.error(`[UAZAPI ERRO Txt]`, error?.response?.data || error?.message);
  }
}

module.exports = { sendText, sendMenu };
