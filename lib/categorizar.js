'use strict'

const CATEGORIAS_VALIDAS = ['Alimentação', 'Transporte', 'Lazer', 'Saúde', 'Moradia', 'Pets', 'Investimentos', 'Outros']

const REGEX_INVESTIMENTO_RDB = /aplica[cç][aã]o\s+rdb|resgate\s+rdb/i

function categorizar(descricao) {
    const d = (descricao || '').toLowerCase()

    if (d.match(/ifood|uber\s*eats|rappi|z[eé]\s*delivery|mercado(?!\s*pago\b|\s*livre\b)|mercadinho|supermercado|atacad[aã]o|assai|carrefour|p[aã]o\s*de\s*a[cç][uú]car|\bextra\b|padaria|a[cç]ougue|hortifruti|\bfeira\b|comida|lanche|pizza|hamb[uú]rguer|\bburguer\b|\bburger\b|mcdonalds|burguer\s*king|\bbk\b|subway|bobs|outback|restaurante|rod[ií]zio|self\s*service|\ba\s*quilo\b|bistro|trattoria|cantina|doceria|sorvete|confeitaria|cacau\s*show|pastel|esfiha|sushi|temaki|yakisoba|\bramen\b|\bpoke\b|habib|china\s*in\s*box|girafas|\bkoni\b|gendai|a[cç]a[ií]|tapioca|\bcrepe\b|caf[eé]|cafeteria|starbucks|coxinha|salgado|marmita|quentinha|churrascaria|espetinho|bebidas|cerveja|chopp|cervejaria|\bbar\b|\bpub\b|buteco|boteco|\bbeer\b|petisco|quiosque|food\s*truck|foodtruck/)) {
        return 'Alimentação'
    }
    if (d.match(/uber|\b99\b|indriver|cabify|gasolina|\bposto\b|auto\s*posto|ipiranga|shell|\bbr\b|raizen|vibra|petrobras|\bale\b|[oô]nibus|metr[oô]|cptm|sptrans|bilhete\s*[uú]nico|ped[aá]gio|sem\s*parar|conectcar|veloe|estacionamento|estapar|combust[ií]vel|etanol|diesel|mec[aâ]nico|oficina|pneu|bateria|auto\s*pe[cç]as|ipva|licenciamento|\bmulta\b|detran|localiza|movida|unidas/)) {
        return 'Transporte'
    }
    if (d.match(/netflix|spotify|cinema|cinemark|kinoplex|\buci\b|moviecom|\bjogo\b|jogos|festa|\bshow\b|balada|streaming|disney|hbo|prime\s*video|amazon\s*prime|youtube\s*premium|apple\s*music|deezer|ingresso|sympla|eventim|ticket360|blueticket|ingresse|xbox|playstation|\bpsn\b|steam|nintendo|teatro|museu|parque|hopi\s*hari|beto\s*carrero|playcenter|boliche|hospedagem|hotel|pousada|airbnb|booking|viagem|passagem|latam|\bgol\b|azul|decolar|\bcvc\b/)) {
        return 'Lazer'
    }
    if (d.match(/rem[eé]dio|farm[aá]cia|droga\s*raia|pague\s*menos|drogasil|drogaria|nissei|pacheco|extrafarma|panvel|onofre|m[eé]dico|sa[uú]de|dentista|odontolog|\bexame\b|laborat[oó]rio|diagn[oó]stico|plano\s*de\s*sa[uú]de|conv[eê]nio\s*m[eé]dico|unimed|sulamerica|bradesco\s*saude|amil|hapvida|hospital|cl[ií]nica|psic[oó]logo|terapia|fisioterapia|academia|smartfit|bluefit|crossfit|suplemento|whey/)) {
        return 'Saúde'
    }
    if (d.match(/\bluz\b|\b[aá]gua\b|internet|aluguel|condom[ií]nio|\bg[aá]s\b|\biptu\b|enel|sabesp|copel|cemig|sanepar|energisa|cpfl|\blight\b|cosern|coelba|celpe|equatorial|vivo|claro|\btim\b|\boi\b|\bnet\b|limpeza|diarista|faxina|material\s*de\s*constru[cç][aã]o|leroy\s*merlin|telhanorte|c&c|dicico|sodimac|tok\s*stok|mobly|madeiramadeira|\betna\b|marcenaria|pintura|reforma|conserto|m[oó]veis|eletrodom[eé]sticos|enxoval|\bcasa\b/)) {
        return 'Moradia'
    }
    if (d.match(/\bpet\b|ra[cç][aã]o|veterin[aá]rio|cachorro|\bgato\b|petshop|pet\s*shop|petlove|cobasi|petz|zee\s*dog|banho\s*e\s*tosa|vacina\s*pet|brinquedo\s*pet|areia\s*gato/)) {
        return 'Pets'
    }
    if (d.match(REGEX_INVESTIMENTO_RDB)) {
        return 'Investimentos'
    }
    return 'Outros'
}

module.exports = { categorizar, CATEGORIAS_VALIDAS, REGEX_INVESTIMENTO_RDB }
