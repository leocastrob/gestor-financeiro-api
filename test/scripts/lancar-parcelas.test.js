'use strict'

const { test } = require('node:test')
const assert = require('node:assert')
const { calcularCompetencia } = require('../../scripts/lancar-parcelas')

test('calcularCompetencia formata mês com zero à esquerda', () => {
    assert.strictEqual(calcularCompetencia(new Date(2026, 0, 15)), '2026-01')
})

test('calcularCompetencia formata mês de dois dígitos sem alteração', () => {
    assert.strictEqual(calcularCompetencia(new Date(2026, 10, 3)), '2026-11')
})
