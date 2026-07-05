'use strict'

module.exports = async function (fastify, opts) {
    // Essa rota vai responder em: GET /api/gastos/
    fastify.get('/', async function (request, reply) {
        try {
            const [linhas] = await fastify.db.query('SELECT * FROM gastos ORDER BY data DESC')
            return linhas
        } catch (erro) {
            fastify.log.error(erro)
            return reply.status(500).send({ erro: 'Falha ao buscar gastos.' })
        }
    })

    // Rota para debug do problema do @lid no WhatsApp
    fastify.get('/debug', async function (request, reply) {
        return global.ultimaMensagemWa || { aviso: 'Nenhuma mensagem recebida ainda' }
    })

    // Essa rota vai responder em: GET /api/gastos/:telefone
    // Filtra os gastos de um número de telefone específico
    fastify.get('/:telefone', async function (request, reply) {
        const { telefone } = request.params
        try {
            const [linhas] = await fastify.db.query(
                'SELECT * FROM gastos WHERE telefone = ? ORDER BY data DESC',
                [telefone]
            )
            return linhas
        } catch (erro) {
            fastify.log.error(erro)
            return reply.status(500).send({ erro: 'Falha ao buscar gastos.' })
        }
    })
}
