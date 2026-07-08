'use strict'

const { test } = require('node:test')
const assert = require('node:assert')
const { categorizar } = require('../../lib/categorizar')

test('categoriza alimentação', () => {
    assert.strictEqual(categorizar('mercado'), 'Alimentação')
    assert.strictEqual(categorizar('Pizza de calabresa'), 'Alimentação')
})

test('categoriza transporte', () => {
    assert.strictEqual(categorizar('uber para casa'), 'Transporte')
    assert.strictEqual(categorizar('gasolina'), 'Transporte')
})

test('categoriza lazer, saúde, moradia e pets', () => {
    assert.strictEqual(categorizar('netflix'), 'Lazer')
    assert.strictEqual(categorizar('farmacia'), 'Saúde')
    assert.strictEqual(categorizar('conta de luz'), 'Moradia')
    assert.strictEqual(categorizar('racao do gato'), 'Pets')
})

test('cai em Outros quando não reconhece nenhuma palavra-chave', () => {
    assert.strictEqual(categorizar('presente para alguém'), 'Outros')
    assert.strictEqual(categorizar(''), 'Outros')
})
