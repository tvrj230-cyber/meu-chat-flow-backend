const fs = require('fs');
const path = require('path');
const { sendText, sendMenu } = require('./uazapi');
const { updateLeadState, getBotFlow } = require('./supabase');

// 1. Carregador Dinâmico do Mapa gerado no Frontend via Supabase
const carregarGrafoJSON = async () => {
    try {
        const flowData = await getBotFlow();
        if (flowData && flowData.nodes && flowData.edges) {
             return flowData;
        }
        console.error("ALERTA: Arquivo de mapa vazio no Banco ou mal formatado!");
        return { nodes: [], edges: [] };
    } catch (e) {
        console.error("ALERTA: Falha de conexão com o Supabase ao carregar o Mapa!");
        return { nodes: [], edges: [] };
    }
}

// 2. Traçador de Rotas (Dado um Bloco e um Conector de Porta, quem é o Bloco Alvo?)
const getProximoBloco = (flow, blocoAtualId, portaIdSaida = null) => {
    const edge = flow.edges.find(e => {
        const matchSource = e.source === blocoAtualId;
        const matchHandle = portaIdSaida ? e.sourceHandle === portaIdSaida : true;
        return matchSource && matchHandle;
    });
    
    if (!edge) return null;
    return flow.nodes.find(n => n.id === edge.target);
}

// 3. O Motor de Execução (O que o robô faz quando "Pisa" num bloco)
const executarBloco = async (flow, bloco, telefone, mensagemMembro = "") => {
    if (!bloco) return;

    console.log(`[Flow Engine] Executando bloco: ${bloco.type} para ${telefone}`);
    await updateLeadState(telefone, bloco.id);

    try {
        switch (bloco.type) {
            case 'messageNode':
                await sendText(telefone, bloco.data.text || "Mensagem Vazia");
                
                // Se for só mensagem de texto, ele já "pula" pro próximo bloco conectado.
                const proxMensagem = getProximoBloco(flow, bloco.id);
                if (proxMensagem) {
                     // Pequeno delay síncrono para a Vercel não matar o container antes do tempo!
                     await new Promise(res => setTimeout(res, 1500));
                     await executarBloco(flow, proxMensagem, telefone, mensagemMembro);
                }
                break;

            case 'menuNode':
                await sendMenu(telefone, bloco.data.text || "Escolha uma opção:", bloco.data.options || []);
                // NÃO CHAMA O PRÓXIMO AQUI! O robô dorme até o clique!
                break;

            case 'conditionNode':
                 let portaEscolhida = 'true';
                 if (bloco.data.rule === 'variavel') {
                     portaEscolhida = mensagemMembro.toLowerCase().trim() === 'sim' ? 'true' : 'false';
                 } else {
                     const options = { timeZone: 'America/Sao_Paulo', hour: 'numeric', hour12: false };
                     const horaAtual = parseInt(new Intl.DateTimeFormat('pt-BR', options).format(new Date()));
                     const start = parseInt((bloco.data.startTime || '08').split(':')[0]);
                     const end = parseInt((bloco.data.endTime || '18').split(':')[0]);
                     portaEscolhida = (horaAtual >= start && horaAtual < end) ? 'true' : 'false';
                 }
                 const proximoCondicao = getProximoBloco(flow, bloco.id, portaEscolhida);
                 if (proximoCondicao) {
                    await executarBloco(flow, proximoCondicao, telefone, mensagemMembro);
                 }
                 break;

            case 'actionNode':
                 if (bloco.data.actionType === 'human_transfer') {
                     await sendText(telefone, "Aguarde um momento, vou transferir você para um atendente humano! 👨‍💻");
                     await updateLeadState(telefone, 'HUMAN_MODE');
                     return;
                 }
                 const proximaAcao = getProximoBloco(flow, bloco.id);
                 if (proximaAcao) await executarBloco(flow, proximaAcao, telefone, mensagemMembro);
                 break;

            case 'tagNode':
                 const proximaTag = getProximoBloco(flow, bloco.id);
                 if (proximaTag) await executarBloco(flow, proximaTag, telefone, mensagemMembro);
                 break;

            case 'delayNode':
                 await sendText(telefone, `[Sistema: O Bot aguardaria timeout aqui]`);
                 const proxDelay = getProximoBloco(flow, bloco.id, 'answered');
                 if (proxDelay) await executarBloco(flow, proxDelay, telefone, mensagemMembro);
                 break;

            default:
                 console.log(`[Aviso] Bloco desconhecido e ignorado: ${bloco.type}`);
        }
    } catch (e) {
        console.error("Falha ao executar bloco:", e.message);
    }
}

// 4. A Função Mestra
const processarMensagemDaUAZAPI = async (telefone, posicaoAtualId, textoDigitado) => {
    const flow = await carregarGrafoJSON();

    if (!posicaoAtualId) {
        const primeiroBlocoDaTela = flow.nodes[0]; 
        if (primeiroBlocoDaTela) await executarBloco(flow, primeiroBlocoDaTela, telefone, textoDigitado);
        return;
    }

    const blocoAtual = flow.nodes.find(n => n.id === posicaoAtualId);
    if (!blocoAtual) {
        await executarBloco(flow, flow.nodes[0], telefone, textoDigitado);
        return;
    }

    if (blocoAtual.type === 'menuNode') {
        const arrayOpcoes = blocoAtual.data.options || [];
        const indiceBotao = arrayOpcoes.findIndex(opt => opt.toLowerCase().trim() === textoDigitado.toLowerCase().trim());
        
        let idPortaConectada = null;
        if (indiceBotao >= 0) {
            idPortaConectada = `option-${indiceBotao}`;
        } else {
            await sendText(telefone, "Desculpe, opção inválida! Por favor, clique no botão do menu acima para prosseguir.");
            return;
        }

        const blocoSeguinte = getProximoBloco(flow, blocoAtual.id, idPortaConectada);
        if (blocoSeguinte) {
             await executarBloco(flow, blocoSeguinte, telefone, textoDigitado);
        } else {
             await updateLeadState(telefone, null);
        }
    } else {
        const blocoSeguinte = getProximoBloco(flow, blocoAtual.id);
        if (blocoSeguinte) await executarBloco(flow, blocoSeguinte, telefone, textoDigitado);
    }
}

module.exports = { processarMensagemDaUAZAPI };
