const fs = require('fs');
const path = require('path');
const { sendText, sendMenu, sendImage } = require('./uazapi');
const { updateLeadState, updateLeadEmail, getBotFlow } = require('./supabase');

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

// 🌟 FUNÇÃO MÁGICA DE VARIÁVEIS NA BLINDADA (V4.1)
const injetarVariaveis = (textoCru, telefone, nomeContato) => {
    if (!textoCru || typeof textoCru !== "string") return "";
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

    // Proteção rigorosa do nome (Caso venha Null ou Vazio da UAZAPI)
    let nomeSeguro = "amigo(a)";
    if (nomeContato && typeof nomeContato === 'string' && nomeContato.trim().length > 0) {
        nomeSeguro = nomeContato.trim();
    }
    const nomeCapitalizado = nomeSeguro.charAt(0).toUpperCase() + nomeSeguro.slice(1);

    // Substituições Dinâmicas Tolerantes (Ignora se o usuário colocou espaços, Ex: {{ nome }} )
    textoPronto = textoPronto.replace(/\{\{\s*nome\s*\}\}/gi, nomeCapitalizado);
    textoPronto = textoPronto.replace(/\{\{\s*telefone\s*\}\}/gi, telefone);
    textoPronto = textoPronto.replace(/\{\{\s*saudacao\s*\}\}/gi, txSaudacao);
    textoPronto = textoPronto.replace(/\{\{\s*hora\s*\}\}/gi, txtHoraReal);
    textoPronto = textoPronto.replace(/\{\{\s*data\s*\}\}/gi, txtDataReal);
    
    console.log(`[Lexical Engine] Texto Cru: "${textoCru}" -> Convertido para: "${textoPronto}"`);
    return textoPronto;
};

// 3. O Motor de Execução (O que o robô faz quando "Pisa" num bloco)
const executarBloco = async (flow, bloco, telefone, mensagemMembro = "", nomeContato = "amigo(a)") => {
    if (!bloco) return;
    
    await updateLeadState(telefone, bloco.id);
    console.log(`[Flow Engine] Executando bloco: ${bloco.type} para ${telefone} (Nome: ${nomeContato})`);

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

            case 'captureNode':
                 const askMsg = injetarVariaveis(bloco.data.text || "Qual seu e-mail?", telefone, nomeContato);
                 await sendText(telefone, askMsg);
                 // Não avança para o próximo bloco, permanece aqui aguardando resposta
                 break;

            default:
                 console.log(`[Aviso] Bloco ignorado: ${bloco.type}`);
        }
    } catch (e) {
        console.error("Falha ao executar bloco:", e.message);
    }
}

// Localiza a raiz do fluxo (Onde ele realmente começa no Canvas)
const getBlocoInicial = (flow) => {
    if (!flow || !flow.nodes || flow.nodes.length === 0) return null;
    const targets = flow.edges.map(e => e.target);
    const roots = flow.nodes.filter(n => !targets.includes(n.id));
    if (roots.length > 0) {
        return roots.sort((a, b) => (a.position?.x || 0) - (b.position?.x || 0))[0];
    }
    return [...flow.nodes].sort((a, b) => (a.position?.x || 0) - (b.position?.x || 0))[0];
};

// 4. A Função Mestra
const processarMensagemDaUAZAPI = async (telefone, posicaoAtualId, textoDigitado, nomeContato = "amigo(a)") => {
    const flow = await carregarGrafoJSON();

    if (!posicaoAtualId) {
        const primeiroBlocoDaTela = getBlocoInicial(flow); 
        if (primeiroBlocoDaTela) {
            await executarBloco(flow, primeiroBlocoDaTela, telefone, textoDigitado, nomeContato);
        }
        return;
    }

    const blocoAtual = flow.nodes.find(n => n.id === posicaoAtualId);
    
    if (!blocoAtual) {
        const primeiroDeVerdade = getBlocoInicial(flow);
        if (primeiroDeVerdade) {
            await executarBloco(flow, primeiroDeVerdade, telefone, textoDigitado, nomeContato);
        }
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
    else if (blocoAtual.type === 'captureNode') {
        const userInput = textoDigitado.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        
        if (emailRegex.test(userInput)) {
             // E-mail válido, salva no CRM
             await updateLeadEmail(telefone, userInput);
             
             // Avança para o próximo bloco
             const blocoSeguinte = getProximoBloco(flow, blocoAtual.id);
             if (blocoSeguinte) {
                  await executarBloco(flow, blocoSeguinte, telefone, textoDigitado, nomeContato);
             } else {
                  await updateLeadState(telefone, null);
             }
        } else {
             // E-mail inválido, envia mensagem de erro e aborta (mantém no mesmo nó)
             const errorMsg = injetarVariaveis(blocoAtual.data.errorMessage || "E-mail inválido, tente novamente.", telefone, nomeContato);
             await sendText(telefone, errorMsg);
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
