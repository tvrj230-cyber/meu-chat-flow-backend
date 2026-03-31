const { getLeadState } = require('../utils/supabase');
const { processarMensagemDaUAZAPI } = require('../utils/flowEngine');

module.exports = async (req, res) => {
    // 1. A UAZAPI manda sempre requisições POST para a Vercel com os dados no `req.body`
    if (req.method !== 'POST') {
        return res.status(200).send("Webhook Online: Motor de Automação JSON V1.0");
    }

    try {
        const payload = req.body;
        console.log("\n[WEBHOOK RECEBIDO]", JSON.stringify(payload, null, 2));

        // 2. Extração dos dados do JSON da UAZAPI de acordo com o Log enviado
        // O número vem do sender_pn interno (ex: "55119999999@s.whatsapp.net") ou do wa_chatid
        let telefoneMembro = "00000";
        if (payload?.message?.sender_pn) {
            telefoneMembro = payload.message.sender_pn.split('@')[0];
        } else if (payload?.chat?.wa_chatid) {
            telefoneMembro = payload.chat.wa_chatid.split('@')[0];
        }

        // A mensagem de texto ou clique
        const mensagemRecebida = payload?.message?.content || payload?.message?.text || "";

        // Impede que as proprias respostas do bot entrem num loop infinito
        if (payload?.message?.fromMe || payload?.message?.wasSentByApi) {
            return res.status(200).send("Ignorado: Mensagem do proprio bot");
        }

        // 3. Consulta rápida no Supabase pra saber o estado do membro
        const stateDoLead = await getLeadState(telefoneMembro);
        
        if (stateDoLead?.current_node === 'HUMAN_MODE') {
             console.log(`Ignorando ${telefoneMembro}. (Traqueado para Atendimento Humano).`);
             return res.status(200).send("Ignored: Human Protocol");
        }

        const nodeId = stateDoLead ? stateDoLead.current_node : null;

        // 4. Passa a batata pro Motor de Grafos Inteligente
        await processarMensagemDaUAZAPI(telefoneMembro, nodeId, mensagemRecebida);

        // A Vercel (assim como qualquer Webhook) exige que a gente retorne status 200 rápido pra ela.
        return res.status(200).json({ status: "success", parsed: true });

    } catch (error) {
        console.error("Erro Grave no Webhook:", error.message);
        return res.status(500).json({ error: "Internal flow disaster." });
    }
};
