'use strict'

module.exports = async function (fastify, opts) {
    // Lista as categorias customizadas do usuário
    fastify.get('/:telefone', async function (request, reply) {
        const { telefone } = request.params

        try {
            const [linhas] = await fastify.db.query(
                'SELECT * FROM categorias_personalizadas WHERE telefone = ? ORDER BY nome ASC',
                [telefone]
            )
            return linhas
        } catch (erro) {
            fastify.log.error(erro)
            return reply.status(500).send({ erro: 'Falha ao buscar categorias personalizadas.' })
        }
    })

    // Cria uma nova categoria personalizada
    fastify.post('/', async function (request, reply) {
        const { telefone, nome, icone, tipo } = request.body || {}

        if (!telefone) {
            return reply.status(400).send({ erro: 'Telefone é obrigatório.' })
        }

        if (!nome || !nome.trim()) {
            return reply.status(400).send({ erro: 'O nome da categoria é obrigatório.' })
        }
        if (nome.trim().length > 50) {
            return reply.status(400).send({ erro: 'Nome da categoria muito longo. Máximo 50 caracteres.' })
        }

        const iconeFinal = (icone && icone.trim()) ? icone.trim().substring(0, 10) : '🏷️'
        const tipoFinal = tipo === 'receita' ? 'receita' : 'despesa'

        try {
            const [resultado] = await fastify.db.query(
                'INSERT INTO categorias_personalizadas (telefone, nome, icone, tipo) VALUES (?, ?, ?, ?)',
                [telefone, nome.trim(), iconeFinal, tipoFinal]
            )
            const [linhas] = await fastify.db.query('SELECT * FROM categorias_personalizadas WHERE id = ?', [resultado.insertId])
            return reply.status(201).send(linhas[0])
        } catch (erro) {
            if (erro.errno === 1062 || erro.code === 'ER_DUP_ENTRY') {
                return reply.status(409).send({ erro: 'Você já possui uma categoria com esse nome.' })
            }
            fastify.log.error(erro)
            return reply.status(500).send({ erro: 'Falha ao criar categoria personalizada.' })
        }
    })

    // Edita uma categoria personalizada (nome e/ou ícone)
    fastify.patch('/:id', async function (request, reply) {
        const { id } = request.params
        const { telefone, nome, icone } = request.body || {}

        if (!telefone) {
            return reply.status(400).send({ erro: 'Telefone é obrigatório para editar.' })
        }

        if (nome !== undefined && (!nome.trim() || nome.trim().length > 50)) {
            return reply.status(400).send({ erro: 'Nome da categoria inválido. Máximo 50 caracteres.' })
        }

        try {
            const [encontradas] = await fastify.db.query(
                'SELECT id FROM categorias_personalizadas WHERE id = ? AND telefone = ?',
                [id, telefone]
            )
            if (encontradas.length === 0) {
                return reply.status(404).send({ erro: 'Categoria não encontrada ou não pertence a este número.' })
            }

            const campos = []
            const valores = []
            if (nome !== undefined) { campos.push('nome = ?'); valores.push(nome.trim()) }
            if (icone !== undefined) { campos.push('icone = ?'); valores.push((icone.trim() || '🏷️').substring(0, 10)) }

            if (campos.length === 0) {
                return reply.status(400).send({ erro: 'Nenhum campo para atualizar.' })
            }

            await fastify.db.query(
                `UPDATE categorias_personalizadas SET ${campos.join(', ')} WHERE id = ? AND telefone = ?`,
                [...valores, id, telefone]
            )

            const [linhas] = await fastify.db.query('SELECT * FROM categorias_personalizadas WHERE id = ?', [id])
            return linhas[0]
        } catch (erro) {
            if (erro.errno === 1062 || erro.code === 'ER_DUP_ENTRY') {
                return reply.status(409).send({ erro: 'Você já possui uma categoria com esse nome.' })
            }
            fastify.log.error(erro)
            return reply.status(500).send({ erro: 'Falha ao editar a categoria.' })
        }
    })

    // Remove uma categoria personalizada
    fastify.delete('/:id', async function (request, reply) {
        const { id } = request.params
        const { telefone } = request.body || {}

        if (!telefone) {
            return reply.status(400).send({ erro: 'Telefone é obrigatório para excluir.' })
        }

        try {
            const [result] = await fastify.db.query(
                'DELETE FROM categorias_personalizadas WHERE id = ? AND telefone = ?',
                [id, telefone]
            )
            
            if (result.affectedRows === 0) {
                return reply.status(404).send({ erro: 'Categoria não encontrada ou não pertence a este número.' })
            }
            
            return { sucesso: true, mensagem: 'Categoria excluída com sucesso.' }
        } catch (erro) {
            fastify.log.error(erro)
            return reply.status(500).send({ erro: 'Falha ao excluir a categoria.' })
        }
    })
}
