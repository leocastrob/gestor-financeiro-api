'use strict'

const CATEGORIAS_VALIDAS = ['Alimentação', 'Transporte', 'Lazer', 'Saúde', 'Moradia', 'Pets', 'Investimentos', 'Outros']

// Varredura automática entre conta corrente e RDB/caixinha de rendimento (ex.: Nubank) —
// dinheiro que só circula internamente, não é gasto/receita real do usuário.
const REGEX_INVESTIMENTO_RDB = /aplica[cç][aã]o\s+rdb|resgate\s+rdb/i

// Descobre a categoria de um gasto a partir da descrição (NLP simples por palavra-chave)
function categorizar(descricao) {
    const d = (descricao || '').toLowerCase()

    // Checa "uber eats"/"ifood"/etc antes do padrão genérico de "uber" (transporte)
    if (d.match(/ifood|uber\s*eats|rappi|z[eé]\s*delivery|mercado|mercadinho|supermercado|atacad[aã]o|assai|carrefour|p[aã]o\s*de\s*a[cç][uú]car|extra|padaria|a[cç]ougue|hortifruti|\bfeira\b|comida|lanche|pizza|pizzaria|hamb[uú]rguer|mcdonalds|burguer\s*king|bk|subway|bobs|outback|restaurante|doceria|sorveteria|confeitaria|cacau\s*show|pastel|esfiha|sushi|temaki|yakisoba|caf[eé]|cafeteria|starbucks|coxinha|salgado|marmita|quentinha|churrascaria|espetinho|bebidas|cerveja|chopp|\bbar\b|buteco|boteco/)) {
        return 'Alimentação'
    }
    if (d.match(/uber|\b99\b|indriver|cabify|gasolina|posto|ipiranga|shell|\bbr\b|[oô]nibus|metr[oô]|cptm|sptrans|bilhete\s*[uú]nico|ped[aá]gio|sem\s*parar|conectcar|veloe|estacionamento|combust[ií]vel|etanol|diesel|mec[aâ]nico|oficina|pneu|bateria|auto\s*pe[cç]as|ipva|licenciamento|multa|detran|localiza|movida|unidas/)) {
        return 'Transporte'
    }
    if (d.match(/netflix|spotify|cinema|\bjogo\b|jogos|festa|\bshow\b|balada|streaming|disney|hbo|prime\s*video|amazon\s*prime|youtube\s*premium|apple\s*music|deezer|ingresso|sympla|eventim|ticket360|xbox|playstation|psn|steam|nintendo|teatro|museu|parque|boliche|hospedagem|hotel|airbnb|viagem|passagem|latam|\bgol\b|azul|decolar|cvc/)) {
        return 'Lazer'
    }
    if (d.match(/rem[eé]dio|farm[aá]cia|droga\s*raia|pague\s*menos|drogasil|drogaria|m[eé]dico|sa[uú]de|dentista|\bexame\b|plano\s*de\s*sa[uú]de|unimed|sulamerica|bradesco\s*saude|amil|hapvida|hospital|cl[ií]nica|psic[oó]logo|terapia|fisioterapia|academia|smartfit|bluefit|crossfit|suplemento|whey/)) {
        return 'Saúde'
    }
    if (d.match(/\bluz\b|\b[aá]gua\b|internet|aluguel|condom[ií]nio|\bg[aá]s\b|\biptu\b|enel|sabesp|copel|cemig|sanepar|vivo|claro|\btim\b|\boi\b|\bnet\b|limpeza|diarista|faxina|material\s*de\s*constru[cç][aã]o|leroy\s*merlin|telhanorte|c&c|tok\s*stok|mobly|marcenaria|pintura|reforma|conserto|m[oó]veis|eletrodom[eé]sticos|enxoval|casa/)) {
        return 'Moradia'
    }
    if (d.match(/\bpet\b|ra[cç][aã]o|veterin[aá]rio|cachorro|\bgato\b|petshop|pet\s*shop|cobasi|petz|zee\s*dog|banho\s*e\s*tosa|vacina\s*pet|brinquedo\s*pet|areia\s*gato/)) {
        return 'Pets'
    }
    if (d.match(REGEX_INVESTIMENTO_RDB)) {
        return 'Investimentos'
    }
    return 'Outros'
}

module.exports = { categorizar, CATEGORIAS_VALIDAS, REGEX_INVESTIMENTO_RDB }
