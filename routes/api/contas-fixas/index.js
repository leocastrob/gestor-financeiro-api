'use strict'

// Removido CATEGORIAS_VALIDAS para suportar Feature 6

module.exports = async function (fastify, opts) {
    // Cria uma conta fixa
    fastify.post('/', async function (request, reply) {
        const {
            telefone,
            descricao,
            categoria,
            valor,
            dia_vencimento: diaVencimento,
            dias_lembrete_antes: diasLembreteAntes = 3,
            lancamento_automatico: lancamentoAutomatico = 0
        } = request.body || {}

        if (!telefone) {
            return reply.status(400).send({ erro: 'Telefone é obrigatório.' })
        }

        if (!descricao || !descricao.trim()) {
            return reply.status(400).send({ erro: 'Descrição é obrigatória.' })
        }

        const categoriaFinal = categoria || 'Moradia'
        if (categoriaFinal.length > 50) {
            return reply.status(400).send({ erro: 'Categoria muito longa. Máximo 50 caracteres.' })
        }

        const valorNumerico = Number(valor)
        if (!valor || Number.isNaN(valorNumerico) || valorNumerico <= 0) {
            return reply.status(400).send({ erro: 'valor precisa ser um número maior que zero.' })
        }

        const diaVenc = Number(diaVencimento)
        if (!diaVencimento || !Number.isInteger(diaVenc) || diaVenc < 1 || diaVenc > 31) {
            return reply.status(400).send({ erro: 'dia_vencimento precisa ser um número entre 1 e 31.' })
        }

        const diasLemb = Number(diasLembreteAntes)
        if (!Number.isInteger(diasLemb) || diasLemb < 0) {
            return reply.status(400).send({ erro: 'dias_lembrete_antes precisa ser um número inteiro positivo.' })
        }

        const automatico = Boolean(lancamentoAutomatico) ? 1 : 0

        try {
            const [resultado] = await fastify.db.query(
                'INSERT INTO contas_fixas (telefone, descricao, categoria, valor, dia_vencimento, dias_lembrete_antes, lancamento_automatico) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [telefone, descricao.trim(), categoriaFinal, valorNumerico, diaVenc, diasLemb, automatico]
            )
            const [linhas] = await fastify.db.query('SELECT * FROM contas_fixas WHERE id = ?', [resultado.insertId])
            return reply.status(201).send(linhas[0])
        } catch (erro) {
            fastify.log.error(erro)
            return reply.status(500).send({ erro: 'Falha ao criar a conta fixa.' })
        }
    })

    // Lista as contas fixas de um telefone, e indica se o pagamento do mês já foi lançado
    fastify.get('/:telefone', async function (request, reply) {
        const { telefone } = request.params

        const agora = new Date()
        const competenciaAtual = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`

        try {
            // Conta as contas_fixas e já identifica se há um gasto lançado na competência atual
            const [linhas] = await fastify.db.query(
                `SELECT c.*, 
                   IF(g.id IS NOT NULL, 1, 0) AS paga_neste_mes
                 FROM contas_fixas c
                 LEFT JOIN gastos g ON g.conta_fixa_id = c.id AND g.competencia = ?
                 WHERE c.telefone = ?
                 ORDER BY c.ativa DESC, c.dia_vencimento ASC`,
                [competenciaAtual, telefone]
            )

            // Converter paga_neste_mes para boolean para facilitar no front
            return linhas.map(l => ({
                ...l,
                paga_neste_mes: l.paga_neste_mes === 1
            }))
        } catch (erro) {
            fastify.log.error(erro)
            return reply.status(500).send({ erro: 'Falha ao buscar contas fixas.' })
        }
    })

    // Edita uma conta fixa
    fastify.patch('/:id', async function (request, reply) {
        const { id } = request.params
        const {
            telefone,
            descricao,
            categoria,
            valor,
            dia_vencimento: diaVencimento,
            dias_lembrete_antes: diasLembreteAntes,
            lancamento_automatico: lancamentoAutomatico
        } = request.body || {}

        if (!telefone) {
            return reply.status(400).send({ erro: 'Telefone é obrigatório para editar.' })
        }

        if (categoria !== undefined && categoria.length > 50) {
            return reply.status(400).send({ erro: 'Categoria muito longa. Máximo 50 caracteres.' })
        }

        try {
            const [contasEncontradas] = await fastify.db.query(
                'SELECT id FROM contas_fixas WHERE id = ? AND telefone = ?',
                [id, telefone]
            )
            if (contasEncontradas.length === 0) {
                return reply.status(404).send({ erro: 'Conta fixa não encontrada ou não pertence a este número.' })
            }

            const campos = []
            const valores = []
            if (descricao !== undefined) { campos.push('descricao = ?'); valores.push(descricao) }
            if (categoria !== undefined) { campos.push('categoria = ?'); valores.push(categoria) }
            if (valor !== undefined) { campos.push('valor = ?'); valores.push(Number(valor)) }
            if (diaVencimento !== undefined) { campos.push('dia_vencimento = ?'); valores.push(Number(diaVencimento)) }
            if (diasLembreteAntes !== undefined) { campos.push('dias_lembrete_antes = ?'); valores.push(Number(diasLembreteAntes)) }
            if (lancamentoAutomatico !== undefined) { campos.push('lancamento_automatico = ?'); valores.push(Boolean(lancamentoAutomatico) ? 1 : 0) }

            if (campos.length === 0) {
                return reply.status(400).send({ erro: 'Nenhum campo para atualizar.' })
            }

            await fastify.db.query(
                `UPDATE contas_fixas SET ${campos.join(', ')} WHERE id = ? AND telefone = ?`,
                [...valores, id, telefone]
            )

            return { sucesso: true, mensagem: 'Conta fixa atualizada com sucesso.' }
        } catch (erro) {
            fastify.log.error(erro)
            return reply.status(500).send({ erro: 'Falha ao atualizar a conta fixa.' })
        }
    })

    // Remove uma conta fixa: hard delete se não houver lançamento, senão soft-delete
    fastify.delete('/:id', async function (request, reply) {
        const { id } = request.params
        const { telefone } = request.body || {}

        if (!telefone) {
            return reply.status(400).send({ erro: 'Telefone é obrigatório para excluir.' })
        }

        try {
            const [contasEncontradas] = await fastify.db.query(
                'SELECT id FROM contas_fixas WHERE id = ? AND telefone = ?',
                [id, telefone]
            )
            if (contasEncontradas.length === 0) {
                return reply.status(404).send({ erro: 'Conta fixa não encontrada ou não pertence a este número.' })
            }

            const [gastosLancados] = await fastify.db.query(
                'SELECT COUNT(*) AS total FROM gastos WHERE conta_fixa_id = ?',
                [id]
            )

            if (gastosLancados[0].total > 0) {
                await fastify.db.query('UPDATE contas_fixas SET ativa = 0 WHERE id = ?', [id])
                return { sucesso: true, mensagem: 'Conta fixa com gastos lançados: marcada como inativa (histórico preservado).' }
            }

            await fastify.db.query('DELETE FROM contas_fixas WHERE id = ?', [id])
            return { sucesso: true, mensagem: 'Conta fixa excluída com sucesso.' }
        } catch (erro) {
            fastify.log.error(erro)
            return reply.status(500).send({ erro: 'Falha ao excluir a conta fixa.' })
        }
    })

    // Lança o pagamento do mês corrente para uma conta fixa (idempotente via UNIQUE KEY)
    fastify.post('/:id/lancar', async function (request, reply) {
        const { id } = request.params

        try {
            const [contasEncontradas] = await fastify.db.query('SELECT * FROM contas_fixas WHERE id = ?', [id])
            if (contasEncontradas.length === 0) {
                return reply.status(404).send({ erro: 'Conta fixa não encontrada.' })
            }
            const conta = contasEncontradas[0]

            if (!conta.ativa) {
                return reply.status(400).send({ erro: 'Conta fixa está inativa.' })
            }

            const agora = new Date()
            const competencia = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`

            let jaLancada = false
            try {
                await fastify.db.query(
                    'INSERT INTO gastos (telefone, descricao, valor, categoria, tipo, conta_fixa_id, competencia) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [conta.telefone, conta.descricao, conta.valor, conta.categoria, 'despesa', id, competencia]
                )
            } catch (erroInsercao) {
                if (erroInsercao.errno === 1062 || erroInsercao.code === 'ER_DUP_ENTRY') {
                    jaLancada = true
                } else {
                    throw erroInsercao
                }
            }

            return { sucesso: true, jaLancada }
        } catch (erro) {
            fastify.log.error(erro)
            return reply.status(500).send({ erro: 'Falha ao lançar a conta fixa.' })
        }
    })

    // Notifica o vencimento da conta ou faz lançamento automático (chamado pelo cron)
    fastify.post('/:id/notificar', async function (request, reply) {
        const { id } = request.params

            try {
                const [contasEncontradas] = await fastify.db.query('SELECT * FROM contas_fixas WHERE id = ?', [id])
                if (contasEncontradas.length === 0) {
                    return reply.status(404).send({ erro: 'Conta fixa não encontrada.' })
                }
                const conta = contasEncontradas[0]

                if (!conta.ativa) {
                    return reply.status(400).send({ erro: 'Conta fixa está inativa.' })
                }

                const agora = new Date()
                const competencia = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`

                // Se for automático, faz o insert já
                if (conta.lancamento_automatico) {
                    let jaLancada = false
                    try {
                        await fastify.db.query(
                            'INSERT INTO gastos (telefone, descricao, valor, categoria, tipo, conta_fixa_id, competencia) VALUES (?, ?, ?, ?, ?, ?, ?)',
                            [conta.telefone, conta.descricao, conta.valor, conta.categoria, 'despesa', id, competencia]
                        )
                    } catch (erroInsercao) {
                        if (erroInsercao.errno === 1062 || erroInsercao.code === 'ER_DUP_ENTRY') {
                            jaLancada = true
                        } else {
                            throw erroInsercao
                        }
                    }

                    if (!jaLancada) {
                        try {
                            await fastify.whatsapp.enviarMensagem(
                                conta.telefone,
                                `✅ *Conta Fixa Lançada*\nSua conta *${conta.descricao}* (R$ ${conta.valor}) foi lançada automaticamente no sistema. (Vencimento: dia ${conta.dia_vencimento})`
                            )
                        } catch (erroWhatsapp) {
                            fastify.log.warn(`Falha ao notificar lançamento automático da conta ${id}: ${erroWhatsapp.message}`)
                        }
                    }

                    return { sucesso: true, mensagem: 'Lançamento automático efetuado.', jaLancada }
                } else {
                    // Notifica para aprovação manual
                    try {
                        await fastify.whatsapp.enviarMensagem(
                            conta.telefone,
                            `🔔 *Lembrete de Vencimento*\nSua conta *${conta.descricao}* de R$ ${conta.valor} vence dia ${conta.dia_vencimento}.\n\nResponda *confirmar ${id}* para lançar o pagamento no Gestor.`
                        )
                        return { sucesso: true, mensagem: 'Lembrete enviado.' }
                    } catch (erroWhatsapp) {
                        fastify.log.warn(`Falha ao enviar lembrete da conta ${id}: ${erroWhatsapp.message}`)
                        return reply.status(502).send({ erro: 'Falha ao enviar mensagem de lembrete pelo WhatsApp.' })
                    }
                }
            } catch (erro) {
                fastify.log.error(erro)
                return reply.status(500).send({ erro: 'Falha ao processar notificação.' })
            }
    })
}
