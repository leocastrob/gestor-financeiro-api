'use strict'

// Regra da data de lançamento (ver docs do spec 2026-07-28):
// - não informada  -> deixa o INSERT usar CURRENT_TIMESTAMP
// - hoje           -> hora atual, para preservar a ordenação `ORDER BY data DESC` do dia
// - passado        -> meio-dia, para que diferença de fuso entre navegador e servidor
//                     nunca empurre o lançamento para o dia anterior
// - futuro         -> rejeitado; infla o mês seguinte sem dinheiro movimentado

const FORMATO_ISO = /^\d{4}-\d{2}-\d{2}$/
const ERRO_FORMATO = 'Data inválida. Use o formato AAAA-MM-DD.'
const ERRO_FUTURO = 'Data não pode ser futura.'

function doisDigitos(numero) {
    return String(numero).padStart(2, '0')
}

// Dia local de um Date, em AAAA-MM-DD
function diaLocalISO(momento) {
    return `${momento.getFullYear()}-${doisDigitos(momento.getMonth() + 1)}-${doisDigitos(momento.getDate())}`
}

function horaLocal(momento) {
    return `${doisDigitos(momento.getHours())}:${doisDigitos(momento.getMinutes())}:${doisDigitos(momento.getSeconds())}`
}

function resolverDataLancamento(valor, agora = new Date()) {
    if (valor === undefined || valor === null || valor === '') {
        return { ok: true, timestamp: null }
    }

    if (typeof valor !== 'string' || !FORMATO_ISO.test(valor)) {
        return { ok: false, erro: ERRO_FORMATO }
    }

    const [ano, mes, dia] = valor.split('-').map(Number)
    // O Date "conserta" datas inexistentes sozinho (2026-02-31 vira 03/03).
    // Comparar os componentes de volta é o que denuncia esse caso.
    const candidata = new Date(ano, mes - 1, dia)
    if (
        candidata.getFullYear() !== ano ||
        candidata.getMonth() !== mes - 1 ||
        candidata.getDate() !== dia
    ) {
        return { ok: false, erro: ERRO_FORMATO }
    }

    // Comparação lexicográfica de AAAA-MM-DD equivale à cronológica
    const hoje = diaLocalISO(agora)
    if (valor > hoje) {
        return { ok: false, erro: ERRO_FUTURO }
    }

    if (valor === hoje) {
        return { ok: true, timestamp: `${valor} ${horaLocal(agora)}` }
    }

    return { ok: true, timestamp: `${valor} 12:00:00` }
}

module.exports = { resolverDataLancamento }
