'use strict'

const { CATEGORIAS_VALIDAS } = require('../../../lib/categorizar')

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

    // Rota para editar um gasto (descrição, categoria e/ou valor). Exige telefone do dono.
    fastify.patch('/:id', async function (request, reply) {
        const { id } = request.params
        const { telefone, descricao, categoria, valor } = request.body || {}

        if (!telefone) {
            return reply.status(400).send({ erro: 'Telefone é obrigatório para editar.' })
        }

        if (categoria !== undefined && !CATEGORIAS_VALIDAS.includes(categoria)) {
            return reply.status(400).send({ erro: `Categoria inválida. Use uma de: ${CATEGORIAS_VALIDAS.join(', ')}.` })
        }

        const campos = []
        const valores = []
        if (descricao !== undefined) { campos.push('descricao = ?'); valores.push(descricao) }
        if (categoria !== undefined) { campos.push('categoria = ?'); valores.push(categoria) }
        if (valor !== undefined) { campos.push('valor = ?'); valores.push(valor) }

        if (campos.length === 0) {
            return reply.status(400).send({ erro: 'Nenhum campo para atualizar.' })
        }

        try {
            const [resultado] = await fastify.db.query(
                `UPDATE gastos SET ${campos.join(', ')} WHERE id = ? AND telefone = ?`,
                [...valores, id, telefone]
            )

            if (resultado.affectedRows === 0) {
                return reply.status(404).send({ erro: 'Gasto não encontrado ou não pertence a este número.' })
            }

            return { sucesso: true, mensagem: 'Gasto atualizado com sucesso.' }
        } catch (erro) {
            fastify.log.error(erro)
            return reply.status(500).send({ erro: 'Falha ao atualizar o gasto.' })
        }
    })
}
