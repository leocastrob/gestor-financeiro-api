'use strict'
const fp = require('fastify-plugin')
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys')
const qrcode = require('qrcode-terminal')
const pino = require('pino')

module.exports = fp(async function (fastify, opts) {

    async function connectToWhatsApp() {
        const { state, saveCreds } = await useMultiFileAuthState('auth_info')

        const sock = makeWASocket({
            auth: state,
            browser: ['Ubuntu', 'Chrome', '120.0.0.0'],
            logger: pino({ level: 'silent' })
        })

        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update
            if (qr) qrcode.generate(qr, { small: true })

            if (connection === 'close') {
                const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut
                if (shouldReconnect) connectToWhatsApp()
            } else if (connection === 'open') {
                fastify.log.info('✅ WhatsApp Bot conectado e operando!')
            }
        })

        sock.ev.on('creds.update', saveCreds)

        sock.ev.on('messages.upsert', async (m) => {
            const msg = m.messages[0]
            if (!msg.message || msg.key.fromMe) return

            const remetente = msg.key.remoteJid
            const texto = msg.message.conversation || msg.message.extendedTextMessage?.text

            if (texto) {
                const valorMatch = texto.match(/[\d.,]+/)
                const descricao = texto.replace(/[\d.,]+/, '').trim()
                const valorBruto = valorMatch ? valorMatch[0] : null

                if (valorBruto && descricao) {
                    const valorNumerico = parseFloat(valorBruto.replace(',', '.'))
                    const telefone = remetente.replace('@s.whatsapp.net', '')

                    try {
                        // Usando o pool de conexões do Fastify
                        await fastify.db.query('INSERT INTO gastos (telefone, descricao, valor) VALUES (?, ?, ?)', [telefone, descricao, valorNumerico])
                        await sock.sendMessage(remetente, { text: `✅ Salvo!\n📱 Nº: ${telefone}\n🛒 Ref: ${descricao}\n💰 Valor: R$ ${valorNumerico}` })
                    } catch (erro) {
                        fastify.log.error('Erro no DB:', erro)
                        await sock.sendMessage(remetente, { text: `❌ Erro interno no banco.` })
                    }
                }
            }
        })
    }

    connectToWhatsApp()
})