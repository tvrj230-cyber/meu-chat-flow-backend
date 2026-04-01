const axios = require('axios');

const UAZAPI_SERVER = process.env.UAZAPI_SERVER_URL || 'https://api.uazapi.com';

async function buildHeaders() {
  const token = process.env.UAZAPI_TOKEN || '';
  return {
    'apikey': token,
    'token': token,
    'Authorization': `Bearer ${token}`,
    'instance': process.env.UAZAPI_INSTANCE || '56mMDx', 
    'Content-Type': 'application/json'
  };
}

async function sendText(phone, text) {
  try {
    const headers = await buildHeaders();
    console.log(`[DEBUG] Rota /send/text disparada.`);
    
    const url = `${UAZAPI_SERVER}/send/text`;
    const payload = {
      instance: process.env.UAZAPI_INSTANCE,
      number: phone,
      text: text,
      token: process.env.UAZAPI_TOKEN
    };

    const res = await axios.post(url, payload, { headers });
    return res.data;
  } catch (error) {
     console.error(`[UAZAPI ERRO Txt]`, error?.response?.data || error.message);
  }
}

async function sendMenu(phone, text, options) {
  try {
    const headers = await buildHeaders();
    const url = `${UAZAPI_SERVER}/send/menu`;
    const payload = {
      instance: process.env.UAZAPI_INSTANCE,
      number: phone,
      type: "button",
      text: text,
      choices: options,
      token: process.env.UAZAPI_TOKEN
    };

    const res = await axios.post(url, payload, { headers });
    return res.data;
  } catch (error) {
     console.error(`[UAZAPI ERRO Menu]`, error?.response?.data || error.message);
  }
}

async function sendImage(phone, imageUrl, caption) {
  try {
    const headers = await buildHeaders();
    console.log(`[DEBUG] Rota Imagem disparada -> ${phone}`);
    // Na UAZAPI geralmente é /send/image ou /send/media
    const url = `${UAZAPI_SERVER}/send/image`;
    const payload = {
      instance: process.env.UAZAPI_INSTANCE,
      number: phone,
      url: imageUrl,
      caption: caption || "",
      token: process.env.UAZAPI_TOKEN
    };

    const res = await axios.post(url, payload, { headers });
    return res.data;
  } catch (error) {
     console.error(`[UAZAPI ERRO Imagem]`, error?.response?.data || error.message);
  }
}

module.exports = { sendText, sendMenu, sendImage };
