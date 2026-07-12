'use strict'

const { parse } = require('csv-parse/sync')
const crypto = require('node:crypto')

/**
 * Parseia um buffer CSV e retorna cabeçalhos + linhas.
 * Tenta detectar automaticamente o delimitador (, ou ;).
 * @param {Buffer} buffer
 * @returns {{ cabecalhos: string[], linhas: Array<Record<string, string>> }}
 */
function parsearCSV(buffer) {
    const texto = buffer.toString('utf-8')

    // Detecta delimitador pela primeira linha
    const primeiraLinha = texto.split('\n')[0] || ''
    const delimitador = primeiraLinha.split(';').length > primeiraLinha.split(',').length ? ';' : ','

    const registros = parse(texto, {
        columns: true,
        skip_empty_lines: true,
        delimiter: delimitador,
        trim: true,
        bom: true, // ignora BOM se presente (comum em CSVs do Excel/bancos BR)
        relax_column_count: true,
    })

    if (registros.length === 0) {
        throw new Error('CSV vazio ou sem dados válidos.')
    }

    const cabecalhos = Object.keys(registros[0])

    return { cabecalhos, linhas: registros }
}

/**
 * Calcula o hash SHA-256 de um cabeçalho CSV normalizado.
 * Usado como chave para perfis de importação (identificação de banco).
 * @param {string[]} cabecalhos
 * @returns {string}
 */
function hashCabecalho(cabecalhos) {
    const normalizado = cabecalhos.map(c => c.trim().toLowerCase()).sort().join('|')
    return crypto.createHash('sha256').update(normalizado).digest('hex')
}

/**
 * Detecta o separador decimal pelo próprio valor e normaliza para o formato
 * que o parseFloat entende (ponto). Evita depender de configuração por perfil:
 * o formato é derivável do dado (ex.: Nubank usa ponto, outros bancos vírgula).
 * @param {string} valorRaw
 * @returns {string}
 */
function normalizarSeparadorDecimal(valorRaw) {
    if (/,\d{2}$/.test(valorRaw)) {
        // vírgula é decimal: remove pontos de milhar, troca vírgula por ponto
        return valorRaw.replace(/\./g, '').replace(',', '.')
    }
    if (/\.\d{2}$/.test(valorRaw)) {
        // ponto já é decimal: remove eventuais vírgulas de milhar
        return valorRaw.replace(/,/g, '')
    }
    // sem separador decimal reconhecível (valor inteiro) — remove milhar de ambos os tipos
    return valorRaw.replace(/[.,]/g, '')
}

/**
 * Aplica um mapeamento de colunas e converte as linhas do CSV em transações normalizadas.
 * @param {Array<Record<string, string>>} linhas — linhas já parseadas
 * @param {{ colunaData: string, colunaDescricao: string, colunaValor: string, colunaIdentificador?: string, formatoData: string }} mapeamento
 * @returns {Array<{ data: string, descricao: string, valor: number, tipo: string, fitid?: string }>}
 */
function aplicarMapeamento(linhas, mapeamento) {
    const { colunaData, colunaDescricao, colunaValor, colunaIdentificador, formatoData } = mapeamento

    return linhas
        .map(linha => {
            const dataRaw = (linha[colunaData] || '').trim()
            const descricao = (linha[colunaDescricao] || '').trim()
            let valorRaw = (linha[colunaValor] || '').trim()

            // Detecta tipo pelo sinal do valor
            const isReceita = !valorRaw.startsWith('-')
            valorRaw = valorRaw.replace(/^[+-]/, '')
            valorRaw = normalizarSeparadorDecimal(valorRaw)

            const valor = Math.abs(parseFloat(valorRaw))

            // Converte data
            const data = converterData(dataRaw, formatoData)
            const tipo = isReceita ? 'receita' : 'despesa'

            // ID nativo do banco (quando o CSV expõe um, ex.: Nubank) — usado direto
            // na deduplicação em vez do hash calculado (mesmo campo que o OFX usa).
            const fitid = colunaIdentificador ? (linha[colunaIdentificador] || '').trim() : undefined

            return { data, descricao, valor, tipo, ...(fitid ? { fitid } : {}) }
        })
        .filter(t => t.data && t.descricao.length > 0 && t.valor > 0 && !isNaN(t.valor))
}

/**
 * Converte uma string de data do formato informado para 'YYYY-MM-DD'.
 * Suporta: DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, DD-MM-YYYY
 * @param {string} dataStr
 * @param {string} formato
 * @returns {string|null}
 */
function converterData(dataStr, formato) {
    if (!dataStr) return null

    let dia, mes, ano

    // Normaliza separadores
    const partes = dataStr.split(/[\/\-.]/)

    switch (formato) {
        case 'DD/MM/YYYY':
        case 'DD-MM-YYYY':
            [dia, mes, ano] = partes
            break
        case 'MM/DD/YYYY':
        case 'MM-DD-YYYY':
            [mes, dia, ano] = partes
            break
        case 'YYYY-MM-DD':
        case 'YYYY/MM/DD':
            [ano, mes, dia] = partes
            break
        default:
            // Tenta DD/MM/YYYY como fallback (mais comum no BR)
            [dia, mes, ano] = partes
    }

    if (!dia || !mes || !ano) return null

    // Garante 2 dígitos
    dia = String(dia).padStart(2, '0')
    mes = String(mes).padStart(2, '0')

    // Ano com 2 dígitos: assume 2000+
    if (String(ano).length === 2) ano = '20' + ano

    const resultado = `${ano}-${mes}-${dia}`

    // Validação básica
    const d = new Date(resultado)
    if (isNaN(d.getTime())) return null

    return resultado
}

module.exports = { parsearCSV, hashCabecalho, aplicarMapeamento, converterData }

