'use strict'

const { CATEGORIAS_VALIDAS } = require('../../../lib/categorizar')

module.exports = async function (fastify, opts) {
    // Lista as metas (tetos por categoria) de um telefone
    fastify.get('/:telefone', async function (request, reply) {
        const { telefone } = request.params

        try {
            const [linhas] = await fastify.db.query('SELECT * FROM metas WHERE telefone = ?', [telefone])
            return linhas
        } catch (erro) {
            fastify.log.error(erro)
            return reply.status(500).send({ erro: 'Falha ao buscar metas.' })
        }
    })

    // Cria ou atualiza o teto de uma categoria (upsert por telefone + categoria)
    fastify.put('/', async function (request, reply) {
        const { telefone, categoria, valor_teto: valorTeto } = request.body || {}

        if (!telefone) {
            return reply.status(400).send({ erro: 'Telefone é obrigatório.' })
        }

        if (!categoria || !CATEGORIAS_VALIDAS.includes(categoria)) {
            return reply.status(400).send({ erro: `Categoria inválida. Use uma de: ${CATEGORIAS_VALIDAS.join(', ')}.` })
        }

        const valorNumerico = Number(valorTeto)
        if (!valorTeto || Number.isNaN(valorNumerico) || valorNumerico <= 0) {
            return reply.status(400).send({ erro: 'valor_teto precisa ser um número maior que zero.' })
        }

        try {
            await fastify.db.query(
                'INSERT INTO metas (telefone, categoria, valor_teto) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE valor_teto = ?',
                [telefone, categoria, valorNumerico, valorNumerico]
            )
            return reply.status(200).send({ telefone, categoria, valor_teto: valorNumerico })
        } catch (erro) {
            fastify.log.error(erro)
            return reply.status(500).send({ erro: 'Falha ao salvar a meta.' })
        }
    })

    // Remove o teto de uma categoria
    fastify.delete('/:telefone/:categoria', async function (request, reply) {
        const { telefone, categoria } = request.params

        try {
            const [resultado] = await fastify.db.query(
                'DELETE FROM metas WHERE telefone = ? AND categoria = ?',
                [telefone, categoria]
            )

            if (resultado.affectedRows === 0) {
                return reply.status(404).send({ erro: 'Meta não encontrada para esta categoria.' })
            }

            return { sucesso: true, mensagem: 'Meta removida com sucesso.' }
        } catch (erro) {
            fastify.log.error(erro)
            return reply.status(500).send({ erro: 'Falha ao remover a meta.' })
        }
    })
}
