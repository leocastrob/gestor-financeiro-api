'use strict'

// Descobre a categoria de um gasto a partir da descrição (NLP simples por palavra-chave)
function categorizar(descricao) {
    const descricaoLower = (descricao || '').toLowerCase()

    if (descricaoLower.match(/ifood|mercado|padaria|comida|lanche|pizza|hamburguer/)) {
        return 'Alimentação'
    }
    if (descricaoLower.match(/uber|99|gasolina|posto|onibus|metro/)) {
        return 'Transporte'
    }
    if (descricaoLower.match(/netflix|spotify|cinema|jogo|festa/)) {
        return 'Lazer'
    }
    if (descricaoLower.match(/remedio|farmacia|medico|saude/)) {
        return 'Saúde'
    }
    if (descricaoLower.match(/luz|agua|internet|aluguel|condominio/)) {
        return 'Moradia'
    }
    if (descricaoLower.match(/pet|racao|veterinario|cachorro|gato/)) {
        return 'Pets'
    }
    return 'Outros'
}

module.exports = { categorizar }
