'use strict'

const { test } = require('node:test')
const assert = require('node:assert')
const { resolverDataLancamento } = require('../../lib/data-lancamento')

// Relógio fixo usado em todos os testes: 28/07/2026 às 14:32:07, hora local.
const AGORA = new Date(2026, 6, 28, 14, 32, 7)

test('valor não informado devolve timestamp nulo (mantém CURRENT_TIMESTAMP)', () => {
    for (const vazio of [undefined, null, '']) {
        assert.deepStrictEqual(resolverDataLancamento(vazio, AGORA), { ok: true, timestamp: null })
    }
})

test('data igual a hoje recebe a hora atual', () => {
    const resultado = resolverDataLancamento('2026-07-28', AGORA)
    assert.deepStrictEqual(resultado, { ok: true, timestamp: '2026-07-28 14:32:07' })
})

test('data no passado recebe meio-dia', () => {
    const resultado = resolverDataLancamento('2026-07-10', AGORA)
    assert.deepStrictEqual(resultado, { ok: true, timestamp: '2026-07-10 12:00:00' })
})

test('data no futuro é rejeitada', () => {
    const resultado = resolverDataLancamento('2026-07-29', AGORA)
    assert.deepStrictEqual(resultado, { ok: false, erro: 'Data não pode ser futura.' })
})

test('formato fora de AAAA-MM-DD é rejeitado', () => {
    for (const invalido of ['28/07/2026', '2026-7-8', '2026-07-28T10:00:00', 'ontem', 20260728]) {
        const resultado = resolverDataLancamento(invalido, AGORA)
        assert.deepStrictEqual(resultado, { ok: false, erro: 'Data inválida. Use o formato AAAA-MM-DD.' })
    }
})

test('dia inexistente no calendário é rejeitado', () => {
    for (const invalido of ['2026-02-31', '2026-13-01', '2026-00-10', '2026-04-31']) {
        const resultado = resolverDataLancamento(invalido, AGORA)
        assert.deepStrictEqual(resultado, { ok: false, erro: 'Data inválida. Use o formato AAAA-MM-DD.' })
    }
})

test('hora e mês de um dígito são preenchidos com zero à esquerda', () => {
    const madrugada = new Date(2026, 0, 5, 3, 4, 9)
    assert.deepStrictEqual(
        resolverDataLancamento('2026-01-05', madrugada),
        { ok: true, timestamp: '2026-01-05 03:04:09' }
    )
})
