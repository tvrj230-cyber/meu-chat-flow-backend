const fs = require('fs');
const path = require('path');
const { sendText, sendMenu } = require('./uazapi');
const { updateLeadState } = require('./supabase');

// 1. Carregador Dinâmico do Mapa gerado no Frontend
const carregarGrafoJSON = () => {
    try {
        const filePath = path.join(process.cwd(), 'flow.json');
        const rawData = fs.readFileSync(filePath);
        return JSON.parse(rawData);
    } catch (e) {
        console.error("ALERTA: Arquivo flow.json não encontrado na raiz do projeto Backend!");
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

    // Salvar no Banco (Supabase) a posição atual do celular
    console.log(`[Flow Engine] Executando bloco: ${bloco.type} para ${telefone}`);
    await updateLeadState(telefone, bloco.id);

    try {
        switch (bloco.type) {
            case 'messageNode':
                await sendText(telefone, bloco.data.text || "Mensagem Vazia");
                
                // Se for só mensagem de texto, ele já "pula" instantaneamente pro próximo bloco conectado.
                const proxMensagem = getProximoBloco(flow, bloco.id);
                if (proxMensagem && proxMensagem.type !== 'menuNode') {
                     // Pequeno delay pra dar sensação de "Digitando..." e não vomitar textos no WhatsApp
                     setTimeout(() => executarBloco(flow, proxMensagem, telefone), 1500);
                } else if (proxMensagem && proxMensagem.type === 'menuNode') {
                     // Engata menu em seguida
                     setTimeout(() => executarBloco(flow, proxMensagem, telefone), 1500);
                }
                break;

            case 'menuNode':
                await sendMenu(telefone, bloco.data.text || "Escolha uma opção:", bloco.data.options || []);
                // NÃO CHAMA O PRÓXIMO AQUI! O robô "dorme" até o usuário enviar outra mensagem clicando no menu.
                break;

            case 'conditionNode':
                 let portaEscolhida = 'true';
                 
                 if (bloco.data.rule === 'variavel') {
                     // Lógica MVP: Checa se a pessoa digitou "sim"
                     portaEscolhida = mensagemMembro.toLowerCase().trim() === 'sim' ? 'true' : 'false';
                 } else {
                     // Lógica MVP Horário (Gera data atual, verifica se tá entre startTime e endTime)
                     // Substituível facilmente por date-fns
                     const horaAtual = new Date().getHours();
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
                     await updateLeadState(telefone, 'HUMAN_MODE'); // Trava a automação
                     return;
                 }
                 if (bloco.data.actionType === 'save_lead') {
                     console.log(`Salvo no Supabase na tabela ${bloco.data.params}`);
                 }
                 // Ações são invisíveis pro usuário, ele passa direto pro próximo bloco (se existir)
                 const proximaAcao = getProximoBloco(flow, bloco.id);
                 if (proximaAcao) await executarBloco(flow, proximaAcao, telefone, mensagemMembro);
                 break;

            case 'tagNode':
                 console.log(`Tag atribuída ao Lead: ${bloco.data.tagName}`);
                 const proximaTag = getProximoBloco(flow, bloco.id);
                 if (proximaTag) await executarBloco(flow, proximaTag, telefone, mensagemMembro);
                 break;

            case 'delayNode':
                 // Vercel Serverless morre em 10 segundos, então "Lembretes longos" precisam 
                 // ser agendados no Supabase Cron. Para o MVP de navegação a gente só informa:
                 await sendText(telefone, `[Sistema: O Bot aguardaria ${bloco.data.time}${bloco.data.unit} aqui, mas avançou para testes]`);
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

// 4. A Função Mestra: Chamada toda vez que o WhatsApp apita
const processarMensagemDaUAZAPI = async (telefone, posicaoAtualId, textoDigitado) => {
    const flow = carregarGrafoJSON();

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
            // Digitou algo que não era botão! Repete a cobrança de botão.
            await sendText(telefone, "Desculpe, opção inválida! Por favor, clique no botão do menu acima para prosseguir.");
            return;
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

module.exports = { processarMensagemDaUAZAPI };
