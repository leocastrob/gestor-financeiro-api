'use strict'

module.exports = async function (fastify, opts) {
    // Essa rota vai responder em: GET /gastos/
    fastify.get('/', async function (request, reply) {
        try {
            const [linhas] = await fastify.db.query('SELECT * FROM gastos ORDER BY data DESC')
            return linhas
        } catch (erro) {
            fastify.log.error(erro)
            return reply.status(500).send({ erro: 'Falha ao buscar gastos.' })
        }
    })
}