const axios = require('axios');

const UAZAPI_SERVER = process.env.UAZAPI_SERVER_URL || 'https://api.uazapi.com';

async function buildHeaders() {
  const token = process.env.UAZAPI_TOKEN || '';
  return {
    // Vamos inundar a requisição com o token em todos os formatos que Sistemas Customizados usam,
    // garantindo que ele ache o bendito "token"!
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
    console.log(`[DEBUG] Rota /send/text disparada. Token lido com sucesso!`);
    
    const url = `${UAZAPI_SERVER}/send/text`;
    const payload = {
      instance: process.env.UAZAPI_INSTANCE,
      number: phone,
      text: text,
      token: process.env.UAZAPI_TOKEN // Também colocado dentro do corpo JSON!
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
      choices: options,
      token: process.env.UAZAPI_TOKEN
    };

    const res = await axios.post(url, payload, { headers });
    console.log(`[UAZAPI Sucesso] Menu enviado -> ${phone}`);
    return res.data;
  } catch (error) {
     console.error(`[UAZAPI ERRO Menu]`, error?.response?.data || error.message);
  }
}

module.exports = { sendText, sendMenu };
