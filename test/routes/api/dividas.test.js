'use strict'

const { test } = require('node:test')
const assert = require('node:assert')
const { build } = require('../../helper')

test('POST /api/dividas exige telefone', async (t) => {
    const app = await build(t)
    const res = await app.inject({
        method: 'POST',
        url: '/api/dividas',
        payload: { descricao: 'Geladeira em 10x', valor_parcela: 150, total_parcelas: 10, data_primeira_parcela: '2026-08-01' }
    })
    assert.strictEqual(res.statusCode, 400)
})

test('POST /api/dividas exige descrição', async (t) => {
    const app = await build(t)
    const res = await app.inject({
        method: 'POST',
        url: '/api/dividas',
        payload: { telefone: '5511999999999', valor_parcela: 150, total_parcelas: 10, data_primeira_parcela: '2026-08-01' }
    })
    assert.strictEqual(res.statusCode, 400)
})

test('POST /api/dividas rejeita categoria inválida', async (t) => {
    const app = await build(t)
    const res = await app.inject({
        method: 'POST',
        url: '/api/dividas',
        payload: { telefone: '5511999999999', descricao: 'Geladeira em 10x', categoria: 'Categoria Inventada', valor_parcela: 150, total_parcelas: 10, data_primeira_parcela: '2026-08-01' }
    })
    assert.strictEqual(res.statusCode, 400)
})

test('POST /api/dividas exige valor_parcela maior que zero', async (t) => {
    const app = await build(t)
    const res = await app.inject({
        method: 'POST',
        url: '/api/dividas',
        payload: { telefone: '5511999999999', descricao: 'Geladeira em 10x', valor_parcela: 0, total_parcelas: 10, data_primeira_parcela: '2026-08-01' }
    })
    assert.strictEqual(res.statusCode, 400)
})

test('POST /api/dividas exige total_parcelas inteiro maior que zero', async (t) => {
    const app = await build(t)
    const res = await app.inject({
        method: 'POST',
        url: '/api/dividas',
        payload: { telefone: '5511999999999', descricao: 'Geladeira em 10x', valor_parcela: 150, total_parcelas: 0, data_primeira_parcela: '2026-08-01' }
    })
    assert.strictEqual(res.statusCode, 400)
})

test('POST /api/dividas exige data_primeira_parcela no formato YYYY-MM-DD', async (t) => {
    const app = await build(t)
    const res = await app.inject({
        method: 'POST',
        url: '/api/dividas',
        payload: { telefone: '5511999999999', descricao: 'Geladeira em 10x', valor_parcela: 150, total_parcelas: 10, data_primeira_parcela: '01/08/2026' }
    })
    assert.strictEqual(res.statusCode, 400)
})

test('POST /api/dividas cria com sucesso e aplica categoria default Outros', async (t) => {
    const app = await build(t)
    let chamada = 0
    app.db.query = async (sql, params) => {
        chamada++
        if (chamada === 1) {
            assert.match(sql, /INSERT INTO dividas/)
            assert.deepStrictEqual(params, ['5511999999999', 'Geladeira em 10x', 'Outros', 150, 10, '2026-08-01'])
            return [{ insertId: 1 }]
        }
        assert.match(sql, /SELECT \* FROM dividas WHERE id = \?/)
        assert.deepStrictEqual(params, [1])
        return [[{ id: 1, telefone: '5511999999999', descricao: 'Geladeira em 10x', categoria: 'Outros', valor_parcela: '150.00', total_parcelas: 10, data_primeira_parcela: '2026-08-01', ativa: 1 }]]
    }
    const res = await app.inject({
        method: 'POST',
        url: '/api/dividas',
        payload: { telefone: '5511999999999', descricao: 'Geladeira em 10x', valor_parcela: 150, total_parcelas: 10, data_primeira_parcela: '2026-08-01' }
    })
    assert.strictEqual(res.statusCode, 201)
    assert.strictEqual(res.json().id, 1)
})

test('GET /api/dividas/:telefone retorna as dívidas com parcelas_pagas calculado', async (t) => {
    const app = await build(t)
    app.db.query = async (sql, params) => {
        assert.match(sql, /LEFT JOIN gastos g ON g\.divida_id = d\.id/)
        assert.deepStrictEqual(params, ['5511999999999'])
        return [[{ id: 1, telefone: '5511999999999', descricao: 'Geladeira em 10x', parcelas_pagas: 3 }]]
    }
    const res = await app.inject({ method: 'GET', url: '/api/dividas/5511999999999' })
    assert.strictEqual(res.statusCode, 200)
    assert.strictEqual(res.json()[0].parcelas_pagas, 3)
})
