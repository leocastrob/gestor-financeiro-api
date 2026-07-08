'use strict'

const { test } = require('node:test')
const assert = require('node:assert')
const { build } = require('../../helper')

test('GET /api/gastos/:telefone retorna os gastos daquele telefone', async (t) => {
    const app = await build(t)

    app.db.query = async (sql, params) => {
        assert.match(sql, /WHERE telefone = \?/)
        assert.deepStrictEqual(params, ['5511999999999'])
        return [[{ id: 1, telefone: '5511999999999', descricao: 'mercado', categoria: 'Alimentação', valor: '50.00' }]]
    }

    const res = await app.inject({ method: 'GET', url: '/api/gastos/5511999999999' })
    assert.strictEqual(res.statusCode, 200)
    assert.strictEqual(res.json().length, 1)
})

test('DELETE /api/gastos/:id exige telefone no corpo', async (t) => {
    const app = await build(t)

    const res = await app.inject({ method: 'DELETE', url: '/api/gastos/1', payload: {} })
    assert.strictEqual(res.statusCode, 400)
})

test('DELETE /api/gastos/:id retorna 404 quando não encontra o gasto', async (t) => {
    const app = await build(t)

    app.db.query = async () => [{ affectedRows: 0 }]

    const res = await app.inject({
        method: 'DELETE',
        url: '/api/gastos/999',
        payload: { telefone: '5511999999999' }
    })
    assert.strictEqual(res.statusCode, 404)
})

test('DELETE /api/gastos/:id exclui com sucesso', async (t) => {
    const app = await build(t)

    app.db.query = async () => [{ affectedRows: 1 }]

    const res = await app.inject({
        method: 'DELETE',
        url: '/api/gastos/1',
        payload: { telefone: '5511999999999' }
    })
    assert.strictEqual(res.statusCode, 200)
    assert.strictEqual(res.json().sucesso, true)
})
