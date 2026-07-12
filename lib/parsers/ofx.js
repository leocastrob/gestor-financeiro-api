'use strict'

const { parse } = require('ofx-js')

/**
 * Parseia um buffer OFX e retorna as transações normalizadas.
 * @param {Buffer} buffer — conteúdo do arquivo OFX
 * @returns {Promise<{ nomeBanco: string|null, transacoes: Array<{ data: string, descricao: string, valor: number, fitid: string }> }>}
 */
async function parsearOFX(buffer) {
    const texto = buffer.toString('latin1') // OFX usa ISO-8859-1 na maioria dos bancos BR
    const dados = await parse(texto)

    const stmtTrnRs =
        dados?.OFX?.BANKMSGSRSV1?.STMTTRNRS ??
        dados?.OFX?.CREDITCARDMSGSRSV1?.CCSTMTTRNRS ??
        null

    if (!stmtTrnRs) {
        throw new Error('Arquivo OFX não contém dados de extrato bancário (STMTTRNRS ou CCSTMTTRNRS).')
    }

    const nomeBanco = stmtTrnRs?.STMTRS?.BANKACCTFROM?.BANKID ??
        stmtTrnRs?.CCSTMTRS?.CCACCTFROM?.ACCTID ??
        null

    const lista =
        stmtTrnRs?.STMTRS?.BANKTRANLIST?.STMTTRN ??
        stmtTrnRs?.CCSTMTRS?.BANKTRANLIST?.STMTTRN ??
        []

    // Se houver apenas uma transação, ofx-js retorna um objeto em vez de array
    const transacoesRaw = Array.isArray(lista) ? lista : [lista]

    const transacoes = transacoesRaw
        .filter(t => t && t.DTPOSTED && t.TRNAMT)
        .map(t => {
            // DTPOSTED vem como "20260715120000[-3:BRT]" — extraímos YYYYMMDD
            const dtStr = String(t.DTPOSTED).slice(0, 8)
            const ano = dtStr.slice(0, 4)
            const mes = dtStr.slice(4, 6)
            const dia = dtStr.slice(6, 8)
            const data = `${ano}-${mes}-${dia}`

            const valor = Math.abs(parseFloat(t.TRNAMT))
            const descricao = (t.MEMO || t.NAME || '').trim()
            const fitid = String(t.FITID || '').trim()

            // OFX: TRNAMT negativo = débito (despesa), positivo = crédito (receita)
            const tipo = parseFloat(t.TRNAMT) >= 0 ? 'receita' : 'despesa'

            return { data, descricao, valor, fitid, tipo }
        })
        .filter(t => t.valor > 0 && t.descricao.length > 0)

    return { nomeBanco, transacoes }
}

module.exports = { parsearOFX }
