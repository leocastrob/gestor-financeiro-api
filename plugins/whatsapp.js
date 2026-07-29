'use strict'
const fp = require('fastify-plugin')
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys')
const qrcode = require('qrcode-terminal')
const pino = require('pino')
const { categorizar } = require('../lib/categorizar')

// Reconexão com espera crescente: 2s, 4s, 8s... até o teto de 60s.
// Sem isso o reconnect vira um loop apertado que nunca aparece no log.
const RECONEXAO_ESPERA_BASE_MS = 2000
const RECONEXAO_ESPERA_MAX_MS = 60000

module.exports = fp(async function (fastify, opts) {

    // Referência ao socket ativo, usada por fastify.whatsapp.enviarMensagem (ex: envio de PIN de login)
    let sockAtual = null
    let tentativasReconexao = 0

    async function connectToWhatsApp() {
        const { state, saveCreds } = await useMultiFileAuthState('auth_info')

        const sock = makeWASocket({
            auth: state,
            browser: ['Ubuntu', 'Chrome', '120.0.0.0'],
            // 'silent' esconde a causa de queda de conexão. WA_LOG_LEVEL permite subir pra 'debug' quando precisa investigar.
            logger: pino({ level: process.env.WA_LOG_LEVEL || 'warn' })
        })

        // Um mesmo socket pode emitir 'close' mais de uma vez; sem essa trava cada
        // emissão agendaria uma reconexão própria e elas se multiplicariam.
        let closeJaTratado = false

        // Mapa que converte LID (Linked Identity) → número de telefone real
        // O Baileys v7 usa LID em vez do telefone em mensagens multi-device
        const lidParaTelefone = {}

        // Quando os contatos sincronizam, o Baileys nos dá o mapa LID ↔ telefone
        sock.ev.on('contacts.update', (contatos) => {
            for (const contato of contatos) {
                if (contato.id && contato.lid) {
                    const lid = contato.lid.split('@')[0]
                    const telefone = contato.id.split('@')[0]
                    lidParaTelefone[lid] = telefone
                    fastify.log.info(`📇 Mapeado: LID ${lid} → Tel ${telefone}`)
                }
            }
        })

        sock.ev.on('contacts.upsert', (contatos) => {
            for (const contato of contatos) {
                if (contato.id && contato.lid) {
                    const lid = contato.lid.split('@')[0]
                    const telefone = contato.id.split('@')[0]
                    lidParaTelefone[lid] = telefone
                    fastify.log.info(`📇 Mapeado: LID ${lid} → Tel ${telefone}`)
                }
            }
        })

        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update
            if (qr) qrcode.generate(qr, { small: true })

            if (connection === 'close') {
                sockAtual = null
                if (closeJaTratado) return
                closeJaTratado = true

                const statusCode = lastDisconnect?.error?.output?.statusCode
                const motivo = lastDisconnect?.error?.message

                // Libera os handlers do socket morto — sem isso cada reconexão acumula listeners
                sock.ev.removeAllListeners()

                if (statusCode === DisconnectReason.loggedOut) {
                    fastify.log.error(
                        { statusCode, motivo },
                        '❌ WhatsApp desconectado: sessão encerrada (loggedOut). Apague auth_info/ e escaneie o QR Code de novo.'
                    )
                    return
                }

                tentativasReconexao += 1
                const espera = Math.min(
                    RECONEXAO_ESPERA_BASE_MS * 2 ** (tentativasReconexao - 1),
                    RECONEXAO_ESPERA_MAX_MS
                )
                fastify.log.warn(
                    { statusCode, motivo, tentativa: tentativasReconexao, esperaMs: espera },
                    '⚠️ WhatsApp desconectou, reconectando'
                )
                setTimeout(() => {
                    connectToWhatsApp().catch((erro) => {
                        fastify.log.error({ erro: erro.message }, '❌ Falha ao reconectar no WhatsApp')
                    })
                }, espera).unref()
            } else if (connection === 'open') {
                sockAtual = sock
                tentativasReconexao = 0
                fastify.log.info('✅ WhatsApp Bot conectado e operando!')
            }
        })

        sock.ev.on('creds.update', saveCreds)

        sock.ev.on('messages.upsert', async (m) => {
            const msg = m.messages[0]
            if (!msg.message || msg.key.fromMe) return

            // O Baileys v7 manda o ID interno (@lid) em remoteJid, e o telefone real no remoteJidAlt
            const enviarPara = msg.key.remoteJid
            const identificador = msg.key.remoteJidAlt || msg.key.remoteJid
            const texto = msg.message.conversation || msg.message.extendedTextMessage?.text

            if (texto) {
                const textoL = texto.trim().toLowerCase()
                
                if (textoL.startsWith('confirmar ')) {
                    const idConta = textoL.split(' ')[1]
                    
                    let telefone = identificador.split('@')[0]
                    if (telefone.endsWith('@lid') && lidParaTelefone[telefone]) {
                        telefone = lidParaTelefone[telefone]
                    }

                    if (!idConta || isNaN(Number(idConta))) {
                        await sock.sendMessage(enviarPara, { text: `❌ ID da conta inválido.` })
                        return
                    }

                    try {
                        // Verifica se a conta existe e pertence ao telefone
                        const [contas] = await fastify.db.query('SELECT telefone FROM contas_fixas WHERE id = ?', [idConta])
                        if (contas.length === 0 || contas[0].telefone !== telefone) {
                            await sock.sendMessage(enviarPara, { text: `❌ Conta não encontrada.` })
                            return
                        }

                        const res = await fastify.inject({
                            method: 'POST',
                            url: `/api/contas-fixas/${idConta}/lancar`
                        })

                        const corpo = res.json()
                        if (res.statusCode === 200) {
                            if (corpo.jaLancada) {
                                await sock.sendMessage(enviarPara, { text: `✅ Esta conta já havia sido lançada neste mês.` })
                            } else {
                                await sock.sendMessage(enviarPara, { text: `✅ Pagamento lançado com sucesso no Gestor!` })
                            }
                        } else {
                            await sock.sendMessage(enviarPara, { text: `❌ Erro: ${corpo.erro}` })
                        }
                    } catch (erro) {
                        fastify.log.error('Erro ao confirmar conta:', erro)
                        await sock.sendMessage(enviarPara, { text: `❌ Erro interno ao confirmar conta.` })
                    }
                    return
                }

                // Prefixo "+" indica receita (ex: "+3000 salário"); sem ele → despesa (retrocompatível)
                const isReceita = texto.trimStart().startsWith('+')
                const textoLimpo = isReceita ? texto.trimStart().slice(1).trim() : texto
                const tipo = isReceita ? 'receita' : 'despesa'

                const valorMatch = textoLimpo.match(/[\d.,]+/)
                const descricao = textoLimpo.replace(/[\d.,]+/, '').trim()
                const valorBruto = valorMatch ? valorMatch[0] : null

                if (valorBruto && descricao) {
                    const valorNumerico = parseFloat(valorBruto.replace(',', '.'))
                    const categoria = isReceita ? 'Outros' : categorizar(descricao)

                    // Extrai o telefone real (do remoteJidAlt)
                    let telefone = identificador.split('@')[0]

                    // Se por algum motivo não veio o JidAlt e ainda for LID, tenta no mapa
                    if (telefone.endsWith('@lid') && lidParaTelefone[telefone]) {
                        telefone = lidParaTelefone[telefone]
                    }

                    try {
                        await fastify.db.query(
                            'INSERT INTO gastos (telefone, descricao, valor, categoria, tipo) VALUES (?, ?, ?, ?, ?)',
                            [telefone, descricao, valorNumerico, categoria, tipo]
                        )
                        const emoji = isReceita ? '💰 Receita' : '🛒 Gasto'
                        await sock.sendMessage(enviarPara, {
                            text: `✅ Salvo!\n📱 Nº: ${telefone}\n${emoji}: ${descricao}\n🏷️ Cat: ${categoria}\n💵 Valor: R$ ${valorNumerico}`
                        })
                    } catch (erro) {
                        fastify.log.error('Erro no DB:', erro)
                        await sock.sendMessage(enviarPara, { text: `❌ Erro interno no banco.` })
                    }
                }
            }
        })
    }

    // Permite que rotas enviem mensagens pelo bot (ex: PIN de login) sem acessar o socket diretamente
    fastify.decorate('whatsapp', {
        enviarMensagem: async (telefone, texto) => {
            if (!sockAtual) {
                throw new Error('WhatsApp não está conectado no momento.')
            }
            await sockAtual.sendMessage(`${telefone}@s.whatsapp.net`, { text: texto })
        }
    })

    // Não conecta ao WhatsApp de verdade durante os testes automatizados
    if (process.env.NODE_ENV !== 'test') {
        connectToWhatsApp().catch((erro) => {
            fastify.log.error({ erro: erro.message }, '❌ Falha ao conectar no WhatsApp na inicialização')
        })
    }
})