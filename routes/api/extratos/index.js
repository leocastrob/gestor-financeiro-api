'use strict'

const { parsearOFX } = require('../../../lib/parsers/ofx')
const { parsearCSV, hashCabecalho, aplicarMapeamento } = require('../../../lib/parsers/csv')
const { gerarIdentificadorExterno, sanitizarDescricao } = require('../../../lib/extrato-utils')
const { categorizar, REGEX_INVESTIMENTO_RDB } = require('../../../lib/categorizar')

module.exports = async function (fastify, opts) {

    // Registra o plugin multipart só neste escopo (evita conflito com rotas JSON)
    await fastify.register(require('@fastify/multipart'), {
        limits: {
            fileSize: 5 * 1024 * 1024, // 5 MB máximo
        },
    })

    // =====================================================================
    // POST /api/extratos/preview
    // Upload do arquivo, detecta formato, retorna info para o front montar
    // o formulário de mapeamento (CSV) ou confirmar a importação (OFX).
    // Não grava nada no banco.
    // =====================================================================
    fastify.post('/preview', async function (request, reply) {
        const data = await request.file()

        if (!data) {
            return reply.status(400).send({ erro: 'Nenhum arquivo enviado.' })
        }

        const telefone = data.fields?.telefone?.value
        if (!telefone) {
            return reply.status(400).send({ erro: 'Telefone é obrigatório.' })
        }

        const buffer = await data.toBuffer()
        const nomeArquivo = (data.filename || '').toLowerCase()

        try {
            // Detecta formato pelo conteúdo e extensão
            const isOFX = nomeArquivo.endsWith('.ofx') || buffer.toString('ascii', 0, 20).includes('OFXHEADER')

            if (isOFX) {
                const { nomeBanco, transacoes } = await parsearOFX(buffer)
                return {
                    formato: 'OFX',
                    nomeBanco,
                    totalLinhas: transacoes.length,
                    precisaMapeamento: false,
                    amostra: transacoes.slice(0, 5),
                }
            }

            // CSV
            const { cabecalhos, linhas } = parsearCSV(buffer)
            const assinatura = hashCabecalho(cabecalhos)

            // Verifica se já existe um perfil de mapeamento salvo para este usuário + cabeçalho
            const [perfis] = await fastify.db.query(
                'SELECT * FROM perfis_importacao_csv WHERE telefone = ? AND assinatura_cabecalho = ?',
                [telefone, assinatura]
            )

            if (perfis.length > 0) {
                // Perfil existe — aplica automaticamente para mostrar preview
                const perfil = perfis[0]
                const transacoes = aplicarMapeamento(linhas, {
                    colunaData: perfil.coluna_data,
                    colunaDescricao: perfil.coluna_descricao,
                    colunaValor: perfil.coluna_valor,
                    colunaIdentificador: perfil.coluna_identificador,
                    formatoData: perfil.formato_data,
                })
                return {
                    formato: 'CSV',
                    nomeBanco: perfil.nome_banco,
                    totalLinhas: transacoes.length,
                    precisaMapeamento: false,
                    amostra: transacoes.slice(0, 5),
                    perfilExistente: true,
                }
            }

            // Sem perfil — front precisa montar o formulário de mapeamento
            return {
                formato: 'CSV',
                nomeBanco: null,
                totalLinhas: linhas.length,
                precisaMapeamento: true,
                colunas: cabecalhos,
                amostra: linhas.slice(0, 3),
                perfilExistente: false,
            }

        } catch (erro) {
            fastify.log.error(erro)
            return reply.status(400).send({ erro: `Erro ao processar arquivo: ${erro.message}` })
        }
    })

    // =====================================================================
    // POST /api/extratos/importar
    // Upload do arquivo + mapeamento (se CSV novo). Processa em memória,
    // grava perfil se novo, faz dedup, insere em gastos, registra o extrato.
    // =====================================================================
    fastify.post('/importar', async function (request, reply) {
        const data = await request.file()

        if (!data) {
            return reply.status(400).send({ erro: 'Nenhum arquivo enviado.' })
        }

        const telefone = data.fields?.telefone?.value
        if (!telefone) {
            return reply.status(400).send({ erro: 'Telefone é obrigatório.' })
        }

        // Mapeamento vem como JSON string no campo do form
        const mapeamentoRaw = data.fields?.mapeamento?.value
        let mapeamento = null
        if (mapeamentoRaw) {
            try {
                mapeamento = JSON.parse(mapeamentoRaw)
            } catch {
                return reply.status(400).send({ erro: 'Mapeamento inválido (JSON malformado).' })
            }
        }

        const buffer = await data.toBuffer()
        const nomeArquivo = (data.filename || '').toLowerCase()

        try {
            const isOFX = nomeArquivo.endsWith('.ofx') || buffer.toString('ascii', 0, 20).includes('OFXHEADER')
            let transacoes = []
            let formato = 'CSV'
            let nomeBanco = null

            if (isOFX) {
                formato = 'OFX'
                const resultado = await parsearOFX(buffer)
                nomeBanco = resultado.nomeBanco
                // Adiciona fitid para deduplicação
                transacoes = resultado.transacoes
            } else {
                // CSV
                const { cabecalhos, linhas } = parsearCSV(buffer)
                const assinatura = hashCabecalho(cabecalhos)

                // Busca perfil existente
                const [perfis] = await fastify.db.query(
                    'SELECT * FROM perfis_importacao_csv WHERE telefone = ? AND assinatura_cabecalho = ?',
                    [telefone, assinatura]
                )

                let perfilFinal
                if (perfis.length > 0) {
                    perfilFinal = {
                        colunaData: perfis[0].coluna_data,
                        colunaDescricao: perfis[0].coluna_descricao,
                        colunaValor: perfis[0].coluna_valor,
                        colunaIdentificador: perfis[0].coluna_identificador,
                        formatoData: perfis[0].formato_data,
                    }
                    nomeBanco = perfis[0].nome_banco
                } else if (mapeamento) {
                    // Valida campos obrigatórios do mapeamento
                    if (!mapeamento.colunaData || !mapeamento.colunaDescricao || !mapeamento.colunaValor) {
                        return reply.status(400).send({ erro: 'Mapeamento incompleto: colunaData, colunaDescricao e colunaValor são obrigatórios.' })
                    }
                    perfilFinal = {
                        colunaData: mapeamento.colunaData,
                        colunaDescricao: mapeamento.colunaDescricao,
                        colunaValor: mapeamento.colunaValor,
                        colunaIdentificador: mapeamento.colunaIdentificador || null,
                        formatoData: mapeamento.formatoData || 'DD/MM/YYYY',
                    }
                    nomeBanco = mapeamento.nomeBanco || null

                    // Salva o perfil para futuras importações
                    await fastify.db.query(
                        `INSERT INTO perfis_importacao_csv
                            (telefone, assinatura_cabecalho, nome_banco, coluna_data, coluna_descricao, coluna_valor, coluna_identificador, formato_data)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                         ON DUPLICATE KEY UPDATE
                            nome_banco = VALUES(nome_banco),
                            coluna_data = VALUES(coluna_data),
                            coluna_descricao = VALUES(coluna_descricao),
                            coluna_valor = VALUES(coluna_valor),
                            coluna_identificador = VALUES(coluna_identificador),
                            formato_data = VALUES(formato_data)`,
                        [telefone, assinatura, nomeBanco, perfilFinal.colunaData, perfilFinal.colunaDescricao, perfilFinal.colunaValor, perfilFinal.colunaIdentificador, perfilFinal.formatoData]
                    )
                } else {
                    return reply.status(400).send({ erro: 'CSV sem perfil salvo e sem mapeamento enviado.' })
                }

                transacoes = aplicarMapeamento(linhas, perfilFinal)
            }

            // Registra o extrato importado (antes de inserir as transações)
            const [extratoResult] = await fastify.db.query(
                `INSERT INTO extratos_importados (telefone, formato, nome_banco, total_linhas)
                 VALUES (?, ?, ?, ?)`,
                [telefone, formato, nomeBanco, transacoes.length]
            )
            const extratoId = extratoResult.insertId

            // Insere transações com deduplicação
            let totalImportadas = 0
            let totalDuplicadas = 0

            for (const t of transacoes) {
                const identificadorExterno = gerarIdentificadorExterno(telefone, t)
                const descSanitizada = sanitizarDescricao(t.descricao)
                const categoria = REGEX_INVESTIMENTO_RDB.test(descSanitizada)
                    ? 'Investimentos'
                    : (t.tipo === 'despesa' ? categorizar(descSanitizada) : 'Outros')

                try {
                    await fastify.db.query(
                        `INSERT INTO gastos (telefone, descricao, valor, categoria, tipo, data, identificador_externo, extrato_id)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                        [telefone, descSanitizada, t.valor, categoria, t.tipo, t.data, identificadorExterno, extratoId]
                    )
                    totalImportadas++
                } catch (erro) {
                    // ER_DUP_ENTRY = 1062 — transação duplicada, ignora silenciosamente
                    if (erro.errno === 1062 || erro.code === 'ER_DUP_ENTRY') {
                        totalDuplicadas++
                    } else {
                        throw erro
                    }
                }
            }

            // Atualiza os contadores no registro do extrato
            await fastify.db.query(
                'UPDATE extratos_importados SET total_importadas = ?, total_duplicadas = ? WHERE id = ?',
                [totalImportadas, totalDuplicadas, extratoId]
            )

            return reply.status(201).send({
                extratoId,
                formato,
                nomeBanco,
                totalLinhas: transacoes.length,
                totalImportadas,
                totalDuplicadas,
            })

        } catch (erro) {
            fastify.log.error(erro)
            return reply.status(500).send({ erro: `Erro ao importar extrato: ${erro.message}` })
        }
    })
}
