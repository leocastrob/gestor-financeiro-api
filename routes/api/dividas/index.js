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

    // Edita uma dívida. Bloqueia total_parcelas/data_primeira_parcela quando já há
    // parcela lançada (COUNT(*) > 0) — permite editar descricao/categoria/valor_parcela
    // sempre. Editar valor_parcela não retroage parcelas já lançadas (comportamento
    // esperado, documentar na UI).
    fastify.patch('/:id', async function (request, reply) {
        const { id } = request.params
        const {
            telefone,
            descricao,
            categoria,
            valor_parcela: valorParcela,
            total_parcelas: totalParcelas,
            data_primeira_parcela: dataPrimeiraParcela,
        } = request.body || {}

        if (!telefone) {
            return reply.status(400).send({ erro: 'Telefone é obrigatório para editar.' })
        }

        if (categoria !== undefined && !CATEGORIAS_VALIDAS.includes(categoria)) {
            return reply.status(400).send({ erro: `Categoria inválida. Use uma de: ${CATEGORIAS_VALIDAS.join(', ')}.` })
        }

        try {
            const [dividasEncontradas] = await fastify.db.query(
                'SELECT id FROM dividas WHERE id = ? AND telefone = ?',
                [id, telefone]
            )
            if (dividasEncontradas.length === 0) {
                return reply.status(404).send({ erro: 'Dívida não encontrada ou não pertence a este número.' })
            }

            const [parcelasLancadas] = await fastify.db.query(
                'SELECT COUNT(*) AS total FROM gastos WHERE divida_id = ?',
                [id]
            )
            const jaTemParcelaLancada = parcelasLancadas[0].total > 0

            if (jaTemParcelaLancada && (totalParcelas !== undefined || dataPrimeiraParcela !== undefined)) {
                return reply.status(400).send({ erro: 'Não é possível alterar total_parcelas ou data_primeira_parcela depois que já há parcela lançada.' })
            }

            const campos = []
            const valores = []
            if (descricao !== undefined) { campos.push('descricao = ?'); valores.push(descricao) }
            if (categoria !== undefined) { campos.push('categoria = ?'); valores.push(categoria) }
            if (valorParcela !== undefined) { campos.push('valor_parcela = ?'); valores.push(Number(valorParcela)) }
            if (totalParcelas !== undefined) { campos.push('total_parcelas = ?'); valores.push(Number(totalParcelas)) }
            if (dataPrimeiraParcela !== undefined) { campos.push('data_primeira_parcela = ?'); valores.push(dataPrimeiraParcela) }

            if (campos.length === 0) {
                return reply.status(400).send({ erro: 'Nenhum campo para atualizar.' })
            }

            await fastify.db.query(
                `UPDATE dividas SET ${campos.join(', ')} WHERE id = ? AND telefone = ?`,
                [...valores, id, telefone]
            )

            return { sucesso: true, mensagem: 'Dívida atualizada com sucesso.' }
        } catch (erro) {
            fastify.log.error(erro)
            return reply.status(500).send({ erro: 'Falha ao atualizar a dívida.' })
        }
    })

    // Remove uma dívida: hard delete só se ainda não houver parcela lançada;
    // senão soft-delete (ativa=0), preservando o histórico em gastos (ON DELETE SET NULL).
    fastify.delete('/:id', async function (request, reply) {
        const { id } = request.params
        const { telefone } = request.body || {}

        if (!telefone) {
            return reply.status(400).send({ erro: 'Telefone é obrigatório para excluir.' })
        }

        try {
            const [dividasEncontradas] = await fastify.db.query(
                'SELECT id FROM dividas WHERE id = ? AND telefone = ?',
                [id, telefone]
            )
            if (dividasEncontradas.length === 0) {
                return reply.status(404).send({ erro: 'Dívida não encontrada ou não pertence a este número.' })
            }

            const [parcelasLancadas] = await fastify.db.query(
                'SELECT COUNT(*) AS total FROM gastos WHERE divida_id = ?',
                [id]
            )

            if (parcelasLancadas[0].total > 0) {
                await fastify.db.query('UPDATE dividas SET ativa = 0 WHERE id = ?', [id])
                return { sucesso: true, mensagem: 'Dívida com parcelas lançadas: marcada como inativa (histórico preservado).' }
            }

            await fastify.db.query('DELETE FROM dividas WHERE id = ?', [id])
            return { sucesso: true, mensagem: 'Dívida excluída com sucesso.' }
        } catch (erro) {
            fastify.log.error(erro)
            return reply.status(500).send({ erro: 'Falha ao excluir a dívida.' })
        }
    })

    // Lança a parcela do mês corrente para uma dívida (idempotente via UNIQUE KEY
    // uq_divida_competencia). Também é o endpoint chamado pelo cron
    // scripts/lancar-parcelas.js via HTTP — ver Architecture no topo do plano.
    fastify.post('/:id/lancar-parcela', async function (request, reply) {
        const { id } = request.params

        try {
            const [dividasEncontradas] = await fastify.db.query('SELECT * FROM dividas WHERE id = ?', [id])
            if (dividasEncontradas.length === 0) {
                return reply.status(404).send({ erro: 'Dívida não encontrada.' })
            }
            const divida = dividasEncontradas[0]

            if (!divida.ativa) {
                return reply.status(400).send({ erro: 'Dívida já está quitada.' })
            }

            const [parcelasLancadas] = await fastify.db.query('SELECT COUNT(*) AS total FROM gastos WHERE divida_id = ?', [id])
            const parcelasPagas = parcelasLancadas[0].total
            const parcelaAtual = parcelasPagas + 1

            const agora = new Date()
            const competencia = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`
            const descricaoParcela = `${divida.descricao} (parcela ${parcelaAtual}/${divida.total_parcelas})`

            let jaLancada = false
            try {
                await fastify.db.query(
                    'INSERT INTO gastos (telefone, descricao, valor, categoria, tipo, divida_id, competencia) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [divida.telefone, descricaoParcela, divida.valor_parcela, divida.categoria, 'despesa', id, competencia]
                )
            } catch (erroInsercao) {
                if (erroInsercao.errno === 1062 || erroInsercao.code === 'ER_DUP_ENTRY') {
                    jaLancada = true
                } else {
                    throw erroInsercao
                }
            }

            const totalPagasAgora = jaLancada ? parcelasPagas : parcelaAtual
            const quitada = totalPagasAgora >= divida.total_parcelas

            if (quitada && divida.ativa) {
                await fastify.db.query('UPDATE dividas SET ativa = 0 WHERE id = ?', [id])
                try {
                    await fastify.whatsapp.enviarMensagem(divida.telefone, `🎉 Dívida quitada: ${divida.descricao}!`)
                } catch (erroWhatsapp) {
                    fastify.log.warn(`Não foi possível notificar quitação da dívida ${id}: ${erroWhatsapp.message}`)
                }
            }

            return { sucesso: true, jaLancada, quitada }
        } catch (erro) {
            fastify.log.error(erro)
            return reply.status(500).send({ erro: 'Falha ao lançar a parcela.' })
        }
    })
}
