const { carregarGrafoJSON, getProximoBloco, executarBloco } = require('../utils/flowEngine');
const { getStagnantLeads } = require('../utils/supabase');

export default async function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        console.log(`[API CRON] Iniciando rotina de Remarketing...`);
        const flow = await carregarGrafoJSON();
        
        // Puxa todos que estão parados há pelo menos 1 hora como margem segura
        const leadsParados = await getStagnantLeads(1); 
        console.log(`[API CRON] Encontrados ${leadsParados.length} leads inativos na base.`);

        let enviosRealizados = 0;

        for (const lead of leadsParados) {
            const currentNodeId = lead.current_node;
            if (!currentNodeId) continue;

            const blocoAtual = flow.nodes.find(n => n.id === currentNodeId);
            if (!blocoAtual) continue;

            // Pega o tempo limite que o Usuário digitou no Builder (Ex: 2 horas)
            const waitHours = parseFloat(blocoAtual.data.timeoutHours) || 1;
            const diffInMs = Date.now() - new Date(lead.updated_at).getTime();
            const hoursPassed = diffInMs / (1000 * 60 * 60);

            // Se o lead já passou do tempo de folga exato desta caixinha
            if (hoursPassed >= waitHours) {
                // Checa se existe a flecha vermelha saindo dessa caixinha
                const blocoRemarketing = getProximoBloco(flow, currentNodeId, 'timeout');

                if (blocoRemarketing) {
                    console.log(`[API CRON] Tempo esgotado! Ativando remarketing para ${lead.phone}.`);
                    
                    // Dispara a flecha vermelha
                    await executarBloco(flow, blocoRemarketing, lead.phone, null);
                    enviosRealizados++;
                }
            }
        }

        res.status(200).json({ status: 'success', message: `Remarketing processado. ${enviosRealizados} clientes recuperados.` });
    } catch (e) {
        console.error("Erro Critico no Cron:", e.message);
        res.status(500).json({ error: 'Erro ao processar as filas de remarketing' });
    }
}
