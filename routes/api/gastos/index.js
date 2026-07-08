'use strict'

module.exports = async function (fastify, opts) {
    // Essa rota vai responder em: GET /api/gastos/:telefone
    // Filtra os gastos de um número de telefone específico e, opcionalmente, por mês e ano
    fastify.get('/:telefone', async function (request, reply) {
        const { telefone } = request.params
        const { mes, ano } = request.query || {}

        let sqlQuery = 'SELECT * FROM gastos WHERE telefone = ?'
        const queryParams = [telefone]

        if (mes && ano) {
            sqlQuery += ' AND MONTH(data) = ? AND YEAR(data) = ?'
            queryParams.push(mes, ano)
        }

        sqlQuery += ' ORDER BY data DESC'

        try {
            const [linhas] = await fastify.db.query(sqlQuery, queryParams)
            return linhas
        } catch (erro) {
            fastify.log.error(erro)
            return reply.status(500).send({ erro: 'Falha ao buscar gastos.' })
        }
    })

    // Rota para deletar um gasto específico (exige que o telefone pertença àquele gasto)
    fastify.delete('/:id', async function (request, reply) {
        const { id } = request.params
        const { telefone } = request.body

        if (!telefone) {
            return reply.status(400).send({ erro: 'Telefone é obrigatório para exclusão.' })
        }

        try {
            const [resultado] = await fastify.db.query(
                'DELETE FROM gastos WHERE id = ? AND telefone = ?',
                [id, telefone]
            )

            if (resultado.affectedRows === 0) {
                return reply.status(404).send({ erro: 'Gasto não encontrado ou não pertence a este número.' })
            }

            return { sucesso: true, mensagem: 'Gasto excluído com sucesso.' }
        } catch (erro) {
            fastify.log.error(erro)
            return reply.status(500).send({ erro: 'Falha ao excluir o gasto.' })
        }
    })
}
