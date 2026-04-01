const fs = require('fs');
const path = require('path');
const { sendText, sendMenu, sendImage } = require('./uazapi');
const { updateLeadState, getBotFlow } = require('./supabase');

// 1. Carregador Dinâmico do Mapa gerado no Frontend via Supabase
const carregarGrafoJSON = async () => {
    try {
        const flowData = await getBotFlow();
       if (flowData && flowData.nodes && flowData.edges) {
            return flowData;
       }
       return { nodes: [], edges: [] };
    } catch {
       return { nodes: [], edges: [] };
    }
}

// 2. Traçador de Rotas
const getProximoBloco = (flow, blocoAtualId, portaIdSaida = null) => {
    let edge;
    if (portaIdSaida) {
         edge = flow.edges.find(e => e.source === blocoAtualId && e.sourceHandle === portaIdSaida);
    } else {
         edge = flow.edges.find(e => e.source === blocoAtualId);
    }
    if (!edge) return null;
    return flow.nodes.find(n => n.id === edge.target);
};

// 🌟 FUNÇÃO MÁGICA DE VARIÁVEIS (V4)
const injetarVariaveis = (textoCru, telefone, nomeContato) => {
    if (!textoCru) return "";
    let textoPronto = textoCru;
    
    // Captura da data e hora exata do servidor em fuso horário de Brasília
    const dataAjustadaStr = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const pedacos = dataAjustadaStr.split(', ');
    const txtDataReal = pedacos[0]; // ex: 03/01/2026
    const txtHoraReal = pedacos[1].split(':').slice(0, 2).join(':'); // ex: 14:30
    
    // Calcula a Saudação ("Bom dia", "Boa tarde", "Boa noite")
    const horaNumerica = parseInt(txtHoraReal.split(":")[0]);
    let txSaudacao = "Bom dia";
    if (horaNumerica >= 12 && horaNumerica < 18) txSaudacao = "Boa tarde";
    else if (horaNumerica >= 18 || horaNumerica < 4) txSaudacao = "Boa noite";

    // 1. Substitui nome do contato (e arruma primeira letra maiúscula)
    const nomeCapitalizado = nomeContato.charAt(0).toUpperCase() + nomeContato.slice(1);
    textoPronto = textoPronto.replace(/\{\{nome\}\}/gi, nomeCapitalizado);
    
    // 2. Telefone bruto
    textoPronto = textoPronto.replace(/\{\{telefone\}\}/gi, telefone);
    
    // 3. Saudação do Dia
    textoPronto = textoPronto.replace(/\{\{saudacao\}\}/gi, txSaudacao);
    
    // 4. Hora e Data do sistema
    textoPronto = textoPronto.replace(/\{\{hora\}\}/gi, txtHoraReal);
    textoPronto = textoPronto.replace(/\{\{data\}\}/gi, txtDataReal);
    
    return textoPronto;
};

// 3. O Motor de Execução (O que o robô faz quando "Pisa" num bloco)
const executarBloco = async (flow, bloco, telefone, mensagemMembro = "", nomeContato = "amigo(a)") => {
    if (!bloco) return;
    
    await updateLeadState(telefone, bloco.id);
    console.log(`[Flow Engine] Executando bloco: ${bloco.type} para ${telefone}`);

    try {
        switch (bloco.type) {
            case 'messageNode':
                const textoFinal = injetarVariaveis(bloco.data.text || "", telefone, nomeContato);
                await sendText(telefone, textoFinal);
                
                const proxMensagem = getProximoBloco(flow, bloco.id);
                if (proxMensagem) {
                     await new Promise(res => setTimeout(res, 1500));
                     await executarBloco(flow, proxMensagem, telefone, mensagemMembro, nomeContato);
                }
                break;

            case 'menuNode':
                const menuTitleParsed = injetarVariaveis(bloco.data.text || "Escolha uma opção:", telefone, nomeContato);
                await sendMenu(telefone, menuTitleParsed, bloco.data.options || []);
                break;

            case 'imageNode':
                const captionParsed = injetarVariaveis(bloco.data.caption || "", telefone, nomeContato);
                await sendImage(telefone, bloco.data.imageUrl || "https://fakeimg.pl/600x400?text=Sem+Link", captionParsed);
                
                const proxImage = getProximoBloco(flow, bloco.id);
                if (proxImage) {
                     await new Promise(res => setTimeout(res, 1500));
                     await executarBloco(flow, proxImage, telefone, mensagemMembro, nomeContato);
                }
                break;

            case 'conditionNode':
                 let portaEscolhida = 'true';
                 
                 if (bloco.data.rule === 'variavel') {
                     portaEscolhida = mensagemMembro.toLowerCase().trim() === 'sim' ? 'true' : 'false';
                 } else {
                     const options = { timeZone: 'America/Sao_Paulo', hour: 'numeric', hour12: false };
                     const horaNoBrasilStr = new Intl.DateTimeFormat('pt-BR', options).format(new Date());
                     const horaAtual = parseInt(horaNoBrasilStr);

                     const start = parseInt((bloco.data.startTime || '08').split(':')[0]);
                     const end = parseInt((bloco.data.endTime || '18').split(':')[0]);
                     
                     portaEscolhida = (horaAtual >= start && horaAtual < end) ? 'true' : 'false';
                 }

                 const proximaCondicao = getProximoBloco(flow, bloco.id, portaEscolhida);
                 if (proximaCondicao) {
                      await executarBloco(flow, proximaCondicao, telefone, mensagemMembro, nomeContato);
                 }
                 break;

            case 'actionNode':
                 if (bloco.data.actionType === 'transferir' || bloco.data.actionType === 'human_transfer') {
                     console.log(`[Ação] Transferindo ${telefone} para atendente humano.`);
                     await updateLeadState(telefone, 'HUMAN_MODE');
                 } else {
                     const proxAcao = getProximoBloco(flow, bloco.id);
                     if (proxAcao) await executarBloco(flow, proxAcao, telefone, mensagemMembro, nomeContato);
                 }
                 break;

            case 'delayNode':
                 const milisegundos = (parseInt(bloco.data.tempo) || 1) * 1000;
                 await new Promise(res => setTimeout(res, milisegundos));
                 
                 const proxDelay = getProximoBloco(flow, bloco.id);
                 if (proxDelay) await executarBloco(flow, proxDelay, telefone, mensagemMembro, nomeContato);
                 break;

            default:
                 console.log(`[Aviso] Bloco ignorado: ${bloco.type}`);
        }
    } catch (e) {
        console.error("Falha ao executar bloco:", e.message);
    }
}

// 4. A Função Mestra
const processarMensagemDaUAZAPI = async (telefone, posicaoAtualId, textoDigitado, nomeContato = "amigo(a)") => {
    const flow = await carregarGrafoJSON();

    if (!posicaoAtualId) {
        const primeiroBlocoDaTela = flow.nodes[0]; 
        if (primeiroBlocoDaTela) {
            await executarBloco(flow, primeiroBlocoDaTela, telefone, textoDigitado, nomeContato);
        }
        return;
    }

    const blocoAtual = flow.nodes.find(n => n.id === posicaoAtualId);
    
    if (!blocoAtual) {
        await executarBloco(flow, flow.nodes[0], telefone, textoDigitado, nomeContato);
        return;
    }

    if (blocoAtual.type === 'menuNode') {
        const arrayOpcoes = blocoAtual.data.options || [];
        const indiceBotao = arrayOpcoes.findIndex(opt => opt.toLowerCase().trim() === textoDigitado.toLowerCase().trim());
        
        let idPortaConectada = null;
        if (indiceBotao >= 0) {
            idPortaConectada = `option-${indiceBotao}`;
        } else {
            console.log(`[Flow Engine] Silenciando menu...`);
            return;
        }

        const blocoSeguinte = getProximoBloco(flow, blocoAtual.id, idPortaConectada);
        if (blocoSeguinte) {
             await executarBloco(flow, blocoSeguinte, telefone, textoDigitado, nomeContato);
        } else {
             await updateLeadState(telefone, null); 
        }
    } 
    else {
        const blocoSeguinte = getProximoBloco(flow, blocoAtual.id);
        if (blocoSeguinte) {
             await executarBloco(flow, blocoSeguinte, telefone, textoDigitado, nomeContato);
        }
    }
}

module.exports = {
    processarMensagemDaUAZAPI,
    carregarGrafoJSON,
    getProximoBloco,
    executarBloco
};
