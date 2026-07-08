'use strict'

const PIN_EXPIRA_MS = 5 * 60 * 1000 // 5 minutos
const REENVIO_MIN_MS = 30 * 1000 // intervalo mínimo entre pedidos do mesmo número
const MAX_TENTATIVAS = 5

module.exports = async function (fastify, opts) {
    // PINs pendentes em memória: processo único (PM2, sem cluster), não precisa persistir em disco/banco
    const pins = new Map()

    // Etapa 1 do login: gera um PIN e manda pelo próprio WhatsApp do bot
    fastify.post('/solicitar-pin', async function (request, reply) {
        const { telefone } = request.body || {}

        if (!telefone || !/^\d{8,15}$/.test(telefone)) {
            return reply.status(400).send({ erro: 'Telefone inválido.' })
        }

        const existente = pins.get(telefone)
        if (existente && Date.now() - existente.criadoEm < REENVIO_MIN_MS) {
            return reply.status(429).send({ erro: 'Aguarde alguns segundos antes de pedir um novo código.' })
        }

        const pin = String(Math.floor(100000 + Math.random() * 900000))
        pins.set(telefone, { pin, criadoEm: Date.now(), expiraEm: Date.now() + PIN_EXPIRA_MS, tentativas: 0 })

        try {
            await fastify.whatsapp.enviarMensagem(
                telefone,
                `🔐 Seu código de acesso ao Gestor Financeiro é: ${pin}\n\nVálido por 5 minutos.`
            )
        } catch (erro) {
            fastify.log.error(erro)
            pins.delete(telefone)
            return reply.status(502).send({
                erro: 'Não foi possível enviar o código pelo WhatsApp. Confira o número (com DDD e código do país) e tente de novo.'
            })
        }

        return { sucesso: true, mensagem: 'Código enviado pelo WhatsApp.' }
    })

    // Etapa 2 do login: confirma o PIN recebido
    fastify.post('/confirmar-pin', async function (request, reply) {
        const { telefone, pin } = request.body || {}

        if (!telefone || !pin) {
            return reply.status(400).send({ erro: 'Telefone e código são obrigatórios.' })
        }

        const registro = pins.get(telefone)

        if (!registro) {
            return reply.status(400).send({ erro: 'Nenhum código pendente para este número. Solicite um novo.' })
        }

        if (Date.now() > registro.expiraEm) {
            pins.delete(telefone)
            return reply.status(400).send({ erro: 'Código expirado. Solicite um novo.' })
        }

        if (registro.pin !== String(pin).trim()) {
            registro.tentativas += 1
            if (registro.tentativas >= MAX_TENTATIVAS) {
                pins.delete(telefone)
                return reply.status(400).send({ erro: 'Muitas tentativas erradas. Solicite um novo código.' })
            }
            return reply.status(400).send({ erro: 'Código incorreto.' })
        }

        pins.delete(telefone)
        return { sucesso: true }
    })
}
