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
    console.log(`[DEBUG] Rota Imagem disparada -> ${phone} c/ link: ${imageUrl}`);
    
    const tentativas = [
        // Tentativa 1: O Padrão exato da documentação send/media
        {
           url: `${UAZAPI_SERVER}/send/media`,
           body: {
               instance: process.env.UAZAPI_INSTANCE,
               number: phone,
               media: imageUrl,
               url: imageUrl, // enviamos ambos por garantia contra a documentação
               type: "image",
               caption: caption || "",
               token: process.env.UAZAPI_TOKEN
           }
        },
        // Tentativa 2: Padrão Z-API/Evolution
        {
           url: `${UAZAPI_SERVER}/message/sendMedia/${process.env.UAZAPI_INSTANCE}`,
           body: {
               number: phone,
               mediaMessage: {
                   mediatype: "image",
                   media: imageUrl,
                   caption: caption || ""
               }
           }
        },
        // Tentativa 3: Padrão Legado
        {
           url: `${UAZAPI_SERVER}/send/image`,
           body: {
               instance: process.env.UAZAPI_INSTANCE,
               number: phone,
               url: imageUrl,
               caption: caption || "",
               token: process.env.UAZAPI_TOKEN
           }
        }
    ];

    let lastError = null;
    for (let config of tentativas) {
        try {
            const res = await axios.post(config.url, config.body, { headers });
            if (res.status === 200 || res.status === 201) return res.data; // Imagem enviada com sucesso!
        } catch (e) {
            lastError = e?.response?.data || e.message;
        }
    }
    
    console.error(`[UAZAPI ERRO Imagem] Nenhuma rota de mídia funcionou. Último erro logado:`, lastError);
  } catch (error) {
     console.error(`[UAZAPI ERRO Imagem Global]`, error.message);
  }
}

module.exports = { sendText, sendMenu, sendImage };
