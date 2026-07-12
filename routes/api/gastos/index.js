'use strict'

const { categorizar, CATEGORIAS_VALIDAS } = require('../../../lib/categorizar')

module.exports = async function (fastify, opts) {
    // Rota para criar um gasto direto pelo portal (o WhatsApp continua sendo o outro caminho).
    // Se a categoria não vier informada, categoriza automaticamente (mesma lógica do bot).
    fastify.post('/', async function (request, reply) {
        const { telefone, descricao, valor, categoria, tipo } = request.body || {}

        if (!telefone) {
            return reply.status(400).send({ erro: 'Telefone é obrigatório.' })
        }

        if (!descricao || !descricao.trim()) {
            return reply.status(400).send({ erro: 'Descrição é obrigatória.' })
        }

        const valorNumerico = Number(valor)
        if (!valor || Number.isNaN(valorNumerico) || valorNumerico <= 0) {
            return reply.status(400).send({ erro: 'Valor precisa ser um número maior que zero.' })
        }

        const tipoFinal = tipo === 'receita' ? 'receita' : 'despesa'

        // Valida categoria apenas para despesas; receitas aceitam qualquer categoria (YAGNI por ora)
        if (tipoFinal === 'despesa' && categoria !== undefined && !CATEGORIAS_VALIDAS.includes(categoria)) {
            return reply.status(400).send({ erro: `Categoria inválida. Use uma de: ${CATEGORIAS_VALIDAS.join(', ')}.` })
        }

        const categoriaFinal = categoria || (tipoFinal === 'despesa' ? categorizar(descricao) : 'Outros')

        try {
            const [resultado] = await fastify.db.query(
                'INSERT INTO gastos (telefone, descricao, valor, categoria, tipo) VALUES (?, ?, ?, ?, ?)',
                [telefone, descricao.trim(), valorNumerico, categoriaFinal, tipoFinal]
            )
            const [linhas] = await fastify.db.query('SELECT * FROM gastos WHERE id = ?', [resultado.insertId])
            return reply.status(201).send(linhas[0])
        } catch (erro) {
            fastify.log.error(erro)
            return reply.status(500).send({ erro: 'Falha ao criar o gasto.' })
        }
    })

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

    // Rota para editar um gasto (descrição, categoria, valor e/ou tipo). Exige telefone do dono.
    fastify.patch('/:id', async function (request, reply) {
        const { id } = request.params
        const { telefone, descricao, categoria, valor, tipo } = request.body || {}

        if (!telefone) {
            return reply.status(400).send({ erro: 'Telefone é obrigatório para editar.' })
        }

        if (tipo !== undefined && !['despesa', 'receita'].includes(tipo)) {
            return reply.status(400).send({ erro: 'Tipo inválido. Use "despesa" ou "receita".' })
        }

        // Valida categoria apenas para despesas
        if (categoria !== undefined && (tipo === 'despesa' || tipo === undefined) && !CATEGORIAS_VALIDAS.includes(categoria)) {
            return reply.status(400).send({ erro: `Categoria inválida. Use uma de: ${CATEGORIAS_VALIDAS.join(', ')}.` })
        }

        const campos = []
        const valores = []
        if (descricao !== undefined) { campos.push('descricao = ?'); valores.push(descricao) }
        if (categoria !== undefined) { campos.push('categoria = ?'); valores.push(categoria) }
        if (valor !== undefined) { campos.push('valor = ?'); valores.push(valor) }
        if (tipo !== undefined) { campos.push('tipo = ?'); valores.push(tipo) }

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
