'use strict'

const crypto = require('node:crypto')

/**
 * Gera um identificador externo para deduplicação de transações.
 * - Para OFX: usa o FITID diretamente (é o ID único definido pelo banco).
 * - Para CSV: calcula sha256(telefone + data + valor + descrição normalizada).
 *
 * @param {string} telefone
 * @param {{ data: string, descricao: string, valor: number, fitid?: string }} transacao
 * @returns {string}
 */
function gerarIdentificadorExterno(telefone, transacao) {
    if (transacao.fitid) {
        return transacao.fitid
    }

    const descNorm = (transacao.descricao || '').trim().toLowerCase().replace(/\s+/g, ' ')
    const payload = `${telefone}|${transacao.data}|${transacao.valor}|${descNorm}`
    return crypto.createHash('sha256').update(payload).digest('hex')
}

/**
 * Sanitiza CPF/CNPJ de uma descrição antes de gravar.
 * CPF/CNPJ é identificador direto sem função no app; nomes de contraparte
 * são dados pessoais mais fracos e podem ser mantidos (decisão do roadmap).
 *
 * @param {string} descricao
 * @returns {string}
 */
function sanitizarDescricao(descricao) {
    return descricao
        // CPF formatado: 123.456.789-00
        .replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, '***CPF***')
        // CNPJ formatado: 12.345.678/0001-00
        .replace(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g, '***CNPJ***')
        // CPF sem pontuação: 11 dígitos soltos
        .replace(/\b\d{11}\b/g, '***CPF***')
        // CNPJ sem pontuação: 14 dígitos soltos
        .replace(/\b\d{14}\b/g, '***CNPJ***')
}

module.exports = { gerarIdentificadorExterno, sanitizarDescricao }
