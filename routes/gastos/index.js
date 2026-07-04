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

    // Essa rota vai responder em: GET /gastos/:telefone
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