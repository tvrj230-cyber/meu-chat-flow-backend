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

        // 2. Extração dos dados do JSON da UAZAPI (O Formato varia de acordo com a doc da Uazapi)
        // Estamos supondo o esquema padrão de recebimento de mensagem textual ou de botão:
        const telefoneMembro = payload.sender || payload.instance || "5511999999999";
        
        // Pode vir do payload.text (texto livre) ou payload.selectedOption (botão)
        const mensagemRecebida = payload.text || payload.selectedOption || ""; 

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
