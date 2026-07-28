'use strict'

// Só o formato é validado aqui; a paleta de 24 cores vive no frontend, que é
// quem restringe a escolha. Uma cor fora da paleta ainda seria renderizável.
const FORMATO_COR = /^#[0-9a-fA-F]{6}$/

// Devolve { ok: true, cor } ou { ok: false }. Ausente/null/'' viram NULL.
function resolverCor(valor) {
    if (valor === undefined || valor === null || valor === '') return { ok: true, cor: null }
    if (typeof valor !== 'string' || !FORMATO_COR.test(valor)) return { ok: false }
    return { ok: true, cor: valor }
}

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
        const { telefone, nome, icone, tipo, cor } = request.body || {}

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

        const corResolvida = resolverCor(cor)
        if (!corResolvida.ok) {
            return reply.status(400).send({ erro: 'Cor inválida. Use o formato #RRGGBB.' })
        }

        try {
            const [resultado] = await fastify.db.query(
                'INSERT INTO categorias_personalizadas (telefone, nome, icone, tipo, cor) VALUES (?, ?, ?, ?, ?)',
                [telefone, nome.trim(), iconeFinal, tipoFinal, corResolvida.cor]
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
        const { telefone, nome, icone, cor } = request.body || {}

        if (!telefone) {
            return reply.status(400).send({ erro: 'Telefone é obrigatório para editar.' })
        }

        if (nome !== undefined && (!nome.trim() || nome.trim().length > 50)) {
            return reply.status(400).send({ erro: 'Nome da categoria inválido. Máximo 50 caracteres.' })
        }

        // hasOwnProperty distingue "campo ausente" (não mexe) de "cor: null"
        // (volta para automática) — depois da desestruturação ambos são undefined.
        const corInformada = Object.prototype.hasOwnProperty.call(request.body || {}, 'cor')
        const corResolvida = resolverCor(cor)
        if (corInformada && !corResolvida.ok) {
            return reply.status(400).send({ erro: 'Cor inválida. Use o formato #RRGGBB.' })
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
            if (corInformada) { campos.push('cor = ?'); valores.push(corResolvida.cor) }

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
