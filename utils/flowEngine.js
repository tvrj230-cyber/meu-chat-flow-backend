const fs = require('fs');
const path = require('path');
const { sendText, sendMenu, sendImage } = require('./uazapi');
const { updateLeadState, getBotFlow } = require('./supabase');

// 1. Carregador Dinâmico do Mapa gerado no Frontend via Supabase
const carregarGrafoJSON = async () => {
    const defaultFlow = { nodes: [], edges: [] };
    const flowFromDB = await getBotFlow();
    if (flowFromDB) {
        return flowFromDB;
    }
    console.warn("Nenhum mapa encontrado no Supabase. Usando default vazio.");
    return defaultFlow;
};

// 2. Ajudante para encontrar a próxima flecha (edge) conectada
const getProximoBloco = (flow, currentId, sourceHandle = null) => {
    let edge;
    if (sourceHandle) {
         edge = flow.edges.find(e => e.source === currentId && e.sourceHandle === sourceHandle);
    } else {
         edge = flow.edges.find(e => e.source === currentId);
    }
    if (!edge) return null;
    return flow.nodes.find(n => n.id === edge.target);
};

// 3. O Motor que executa visualmente a caixinha atual
const executarBloco = async (flow, bloco, telefone, mensagemMembro) => {
    if (!bloco) return;
    
    // Atualiza imediatamente que o lead está nesta caixinha
    await updateLeadState(telefone, bloco.id);
    console.log(`[Flow Engine] Executando bloco: ${bloco.type} para ${telefone}`);

    try {
        switch (bloco.type) {
            case 'messageNode':
                await sendText(telefone, bloco.data.text || "");
                
                const proxMensagem = getProximoBloco(flow, bloco.id);
                if (proxMensagem) {
                     // Timer de digitação sincronizado para Vercel não matar!
                     await new Promise(res => setTimeout(res, 1500));
                     await executarBloco(flow, proxMensagem, telefone, mensagemMembro);
                }
                break;

            case 'menuNode':
                await sendMenu(telefone, bloco.data.text || "Escolha uma opção:", bloco.data.options || []);
                // NÃO CHAMA O PRÓXIMO AQUI! O robô "dorme" até o usuário enviar outra mensagem clicando no menu.
                break;

            case 'imageNode':
                await sendImage(telefone, bloco.data.imageUrl || "https://fakeimg.pl/600x400?text=Sem+Link", bloco.data.caption || "");
                
                const proxImage = getProximoBloco(flow, bloco.id);
                if (proxImage) {
                     await new Promise(res => setTimeout(res, 1500));
                     await executarBloco(flow, proxImage, telefone, mensagemMembro);
                }
                break;

            case 'conditionNode':
                 let portaEscolhida = 'true';
                 
                 if (bloco.data.rule === 'variavel') {
                     // Lógica MVP: Checa se a pessoa digitou "sim"
                     portaEscolhida = mensagemMembro.toLowerCase().trim() === 'sim' ? 'true' : 'false';
                 } else {
                     // Lógica Horário: A Vercel roda em UTC (Inglaterra/EUA), precisamos forçar a hora do Brasil!
                     const options = { timeZone: 'America/Sao_Paulo', hour: 'numeric', hour12: false };
                     const horaNoBrasilStr = new Intl.DateTimeFormat('pt-BR', options).format(new Date());
                     const horaAtual = parseInt(horaNoBrasilStr); // Pega a hora local real de BR

                     const start = parseInt((bloco.data.startTime || '08').split(':')[0]);
                     const end = parseInt((bloco.data.endTime || '18').split(':')[0]);
                     
                     // Checa se está no expediente
                     if (horaAtual >= start && horaAtual < end) {
                          portaEscolhida = 'true'; // Expediente
                     } else {
                          portaEscolhida = 'false'; // Fora do expediente
                     }
                 }

                 const proximaCondicao = getProximoBloco(flow, bloco.id, portaEscolhida);
                 if (proximaCondicao) {
                      await executarBloco(flow, proximaCondicao, telefone, mensagemMembro);
                 }
                 break;

            case 'actionNode':
                 // Exemplo Trivial: Transfere para humano (Apenas para o funil)
                 if (bloco.data.actionType === 'transferir') {
                     console.log(`[Ação] Transferindo ${telefone} para atendente humano.`);
                     await updateLeadState(telefone, 'HUMANO');
                 } else {
                     // Passa direto pra frente se for outra Ação simples
                     const proxAcao = getProximoBloco(flow, bloco.id);
                     if (proxAcao) await executarBloco(flow, proxAcao, telefone, mensagemMembro);
                 }
                 break;

            case 'delayNode':
                 // Na vida real serverless vira CronJob. No MVP, dormimos o limite da Vercel
                 const milisegundos = (parseInt(bloco.data.tempo) || 1) * 1000;
                 console.log(`[Aguardando] ${milisegundos}ms para o lead ${telefone}...`);
                 
                 await new Promise(res => setTimeout(res, milisegundos));
                 
                 const proxDelay = getProximoBloco(flow, bloco.id);
                 if (proxDelay) await executarBloco(flow, proxDelay, telefone, mensagemMembro);
                 break;

            default:
                 console.log(`[Aviso] Bloco desconhecido e ignorado: ${bloco.type}`);
        }
    } catch (e) {
        console.error("Falha ao executar bloco:", e.message);
    }
}

// 4. A Função Mestra: Chamada toda vez que o WhatsApp apita
const processarMensagemDaUAZAPI = async (telefone, posicaoAtualId, textoDigitado) => {
    const flow = await carregarGrafoJSON();

    // Cenário 1: Lead completamente novo (Nunca falou ou State resetado)
    if (!posicaoAtualId) {
        // Pega o primeiro bloco que desenhamos no mapa (Normalmente as Boas Vindas)
        // OBS: Numa árvore real, você procura o bloco que NÃO tem entrada (source)
        const primeiroBlocoDaTela = flow.nodes[0]; 
        
        if (primeiroBlocoDaTela) {
            await executarBloco(flow, primeiroBlocoDaTela, telefone, textoDigitado);
        }
        return;
    }

    // Cenário 2: O Lead já estava conversando. Acha onde ele parou!
    const blocoAtual = flow.nodes.find(n => n.id === posicaoAtualId);
    
    if (!blocoAtual) {
        // Se o banco apontar pra um bloco que não existe mais no JSON (você deletou no painel)
        console.log("Bloco apagado do mapa. Reiniciando funil.");
        await executarBloco(flow, flow.nodes[0], telefone, textoDigitado);
        return;
    }

    // Cenário 3: O cara clicou numa opção de um MENU UAZAPI. Precisamos adivinhar a porta (Handle).
    if (blocoAtual.type === 'menuNode') {
        const arrayOpcoes = blocoAtual.data.options || [];
        
        // A UAZAPI te devolve o título do botão clicado como string no Callback
        const indiceBotao = arrayOpcoes.findIndex(opt => opt.toLowerCase().trim() === textoDigitado.toLowerCase().trim());
        
        let idPortaConectada = null;
        if (indiceBotao >= 0) {
            idPortaConectada = `option-${indiceBotao}`;
        } else {
            console.log(`[Flow Engine] Lead ${telefone} digitou algo ignorado pelo Menu. Silenciando...`);
            return; // Encerra sem chatear o cliente e mantém ele no `current_node` MENU.
        }

        // Se acertou o botão, acha pra qual caixinha a linha daquele botão estava ligada!
        const blocoSeguinte = getProximoBloco(flow, blocoAtual.id, idPortaConectada);
        if (blocoSeguinte) {
             await executarBloco(flow, blocoSeguinte, telefone, textoDigitado);
        } else {
             console.log("Fim do fluxo (O botão clicado não tinha flecha conectada).");
             await updateLeadState(telefone, null); // Reseta
        }
    } 
    // Outros cenários onde o cara responde fora de menu, como numa pergunta livre.
    else {
        // Apenas acha o próximo nó da flecha única e manda bala.
        const blocoSeguinte = getProximoBloco(flow, blocoAtual.id);
        if (blocoSeguinte) {
             await executarBloco(flow, blocoSeguinte, telefone, textoDigitado);
        }
    }
}

module.exports = {
    processarMensagemDaUAZAPI
};
