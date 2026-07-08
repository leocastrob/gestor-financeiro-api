'use strict'

const CATEGORIAS_VALIDAS = ['Alimentação', 'Transporte', 'Lazer', 'Saúde', 'Moradia', 'Pets', 'Outros']

// Descobre a categoria de um gasto a partir da descrição (NLP simples por palavra-chave)
function categorizar(descricao) {
    const d = (descricao || '').toLowerCase()

    // Checa "uber eats"/"ifood"/etc antes do padrão genérico de "uber" (transporte)
    if (d.match(/ifood|uber\s*eats|rappi|mercado|mercadinho|supermercado|padaria|a[cç]ougue|\bfeira\b|comida|lanche|pizza|hamb[uú]rguer|restaurante|doceria|sorveteria/)) {
        return 'Alimentação'
    }
    if (d.match(/uber|\b99\b|gasolina|posto|[oô]nibus|metr[oô]|ped[aá]gio|estacionamento|combust[ií]vel/)) {
        return 'Transporte'
    }
    if (d.match(/netflix|spotify|cinema|\bjogo\b|festa|\bshow\b|\bbar\b|balada|streaming|disney|hbo|prime\s*video|ingresso/)) {
        return 'Lazer'
    }
    if (d.match(/rem[eé]dio|farm[aá]cia|m[eé]dico|sa[uú]de|dentista|\bexame\b|plano de sa[uú]de/)) {
        return 'Saúde'
    }
    if (d.match(/\bluz\b|\b[aá]gua\b|internet|aluguel|condom[ií]nio|\bg[aá]s\b|\biptu\b/)) {
        return 'Moradia'
    }
    if (d.match(/\bpet\b|ra[cç][aã]o|veterin[aá]rio|cachorro|\bgato\b|petshop|pet\s*shop/)) {
        return 'Pets'
    }
    return 'Outros'
}

module.exports = { categorizar, CATEGORIAS_VALIDAS }
