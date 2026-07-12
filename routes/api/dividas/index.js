'use strict'

const { CATEGORIAS_VALIDAS } = require('../../../lib/categorizar')

const DATA_REGEX = /^\d{4}-\d{2}-\d{2}$/

module.exports = async function (fastify, opts) {
    // Cria uma dívida parcelada
    fastify.post('/', async function (request, reply) {
        const {
            telefone,
            descricao,
            categoria,
            valor_parcela: valorParcela,
            total_parcelas: totalParcelas,
            data_primeira_parcela: dataPrimeiraParcela,
        } = request.body || {}

        if (!telefone) {
            return reply.status(400).send({ erro: 'Telefone é obrigatório.' })
        }

        if (!descricao || !descricao.trim()) {
            return reply.status(400).send({ erro: 'Descrição é obrigatória.' })
        }

        const categoriaFinal = categoria || 'Outros'
        if (!CATEGORIAS_VALIDAS.includes(categoriaFinal)) {
            return reply.status(400).send({ erro: `Categoria inválida. Use uma de: ${CATEGORIAS_VALIDAS.join(', ')}.` })
        }

        const valorParcelaNumerico = Number(valorParcela)
        if (!valorParcela || Number.isNaN(valorParcelaNumerico) || valorParcelaNumerico <= 0) {
            return reply.status(400).send({ erro: 'valor_parcela precisa ser um número maior que zero.' })
        }

        const totalParcelasNumerico = Number(totalParcelas)
        if (!totalParcelas || !Number.isInteger(totalParcelasNumerico) || totalParcelasNumerico <= 0) {
            return reply.status(400).send({ erro: 'total_parcelas precisa ser um número inteiro maior que zero.' })
        }

        if (!dataPrimeiraParcela || !DATA_REGEX.test(dataPrimeiraParcela) || Number.isNaN(new Date(dataPrimeiraParcela).getTime())) {
            return reply.status(400).send({ erro: 'data_primeira_parcela precisa estar no formato YYYY-MM-DD.' })
        }

        try {
            const [resultado] = await fastify.db.query(
                'INSERT INTO dividas (telefone, descricao, categoria, valor_parcela, total_parcelas, data_primeira_parcela) VALUES (?, ?, ?, ?, ?, ?)',
                [telefone, descricao.trim(), categoriaFinal, valorParcelaNumerico, totalParcelasNumerico, dataPrimeiraParcela]
            )
            const [linhas] = await fastify.db.query('SELECT * FROM dividas WHERE id = ?', [resultado.insertId])
            return reply.status(201).send(linhas[0])
        } catch (erro) {
            fastify.log.error(erro)
            return reply.status(500).send({ erro: 'Falha ao criar a dívida.' })
        }
    })

    // Lista as dívidas de um telefone, com parcelas_pagas calculado sob demanda
    // (nunca persistido — elimina risco de drift, ver Architecture no topo do plano)
    fastify.get('/:telefone', async function (request, reply) {
        const { telefone } = request.params

        try {
            const [linhas] = await fastify.db.query(
                `SELECT d.*, COUNT(g.id) AS parcelas_pagas
                 FROM dividas d
                 LEFT JOIN gastos g ON g.divida_id = d.id
                 WHERE d.telefone = ?
                 GROUP BY d.id
                 ORDER BY d.ativa DESC, d.criado_em DESC`,
                [telefone]
            )
            return linhas
        } catch (erro) {
            fastify.log.error(erro)
            return reply.status(500).send({ erro: 'Falha ao buscar dívidas.' })
        }
    })
}
