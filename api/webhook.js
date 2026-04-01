const { getLeadState, updateLeadState } = require('../utils/supabase');
const { processarMensagemDaUAZAPI } = require('../utils/flowEngine');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(200).send("Webhook Online: Motor de Automação Lexical V4.0");
    }

    try {
        const payload = req.body;
        console.log("\n[WEBHOOK RECEBIDO]", JSON.stringify(payload, null, 2));

        let telefoneMembro = "00000";
        if (payload?.message?.sender_pn) {
            telefoneMembro = payload.message.sender_pn.split('@')[0];
        } else if (payload?.chat?.wa_chatid) {
            telefoneMembro = payload.chat.wa_chatid.split('@')[0];
        }

        // 🌟 Tenta capturar o nome de perfil do Usuário que ele salvou no próprio WhatsApp!
        let nomeDoMembro = "amigo(a)";
        if (payload?.message?.pushName) nomeDoMembro = payload.message.pushName;
        else if (payload?.pushName) nomeDoMembro = payload.pushName;
        else if (payload?.data?.pushName) nomeDoMembro = payload.data.pushName;
        else if (payload?.sender?.name) nomeDoMembro = payload.sender.name;

        let mensagemRecebida = "";
        if (payload?.message?.buttonOrListid) {
             mensagemRecebida = payload.message.buttonOrListid; 
        } else if (payload?.message?.vote) {
             mensagemRecebida = payload.message.vote; 
        } else if (typeof payload?.message?.content === 'string') {
             mensagemRecebida = payload.message.content; 
        } else if (payload?.message?.text) {
             mensagemRecebida = payload.message.text; 
        }

        if (payload?.message?.fromMe || payload?.message?.wasSentByApi) {
            return res.status(200).send("Ignorado: Mensagem do proprio bot");
        }

        if (mensagemRecebida.trim().toLowerCase() === '/reset') {
             console.log(`[DEBUG] Reset de testes solicitado por ${telefoneMembro}`);
             await updateLeadState(telefoneMembro, null);
             await processarMensagemDaUAZAPI(telefoneMembro, null, 'oi', nomeDoMembro);
             return res.status(200).json({ status: "reset_forced" });
        }

        const stateDoLead = await getLeadState(telefoneMembro);
        
        if (stateDoLead?.current_node === 'HUMAN_MODE') {
             console.log(`Ignorando ${telefoneMembro}. (Traqueado para Atendimento Humano).`);
             return res.status(200).send("Ignored: Human Protocol");
        }

        const nodeId = stateDoLead ? stateDoLead.current_node : null;

        // Passa a Bola pro motor com o NOME EXTRAÍDO agora!
        await processarMensagemDaUAZAPI(telefoneMembro, nodeId, mensagemRecebida, nomeDoMembro);

        return res.status(200).json({ status: "success" });

    } catch (error) {
        console.error("Erro Grave no Webhook:", error.message);
        return res.status(500).json({ error: "Internal flow disaster." });
    }
};
