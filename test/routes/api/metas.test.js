'use strict'

const { test } = require('node:test')
const assert = require('node:assert')
const { build } = require('../../helper')

test('GET /api/metas/:telefone retorna as metas daquele telefone', async (t) => {
    const app = await build(t)

    app.db.query = async (sql, params) => {
        assert.match(sql, /SELECT \* FROM metas WHERE telefone = \?/)
        assert.deepStrictEqual(params, ['5511999999999'])
        return [[{ telefone: '5511999999999', categoria: 'Alimentação', valor_teto: '800.00' }]]
    }

    const res = await app.inject({ method: 'GET', url: '/api/metas/5511999999999' })
    assert.strictEqual(res.statusCode, 200)
    assert.strictEqual(res.json().length, 1)
})

test('PUT /api/metas exige telefone', async (t) => {
    const app = await build(t)

    const res = await app.inject({
        method: 'PUT',
        url: '/api/metas',
        payload: { categoria: 'Alimentação', valor_teto: 800 }
    })
    assert.strictEqual(res.statusCode, 400)
})

test('PUT /api/metas rejeita categoria inválida', async (t) => {
    const app = await build(t)

    const res = await app.inject({
        method: 'PUT',
        url: '/api/metas',
        payload: { telefone: '5511999999999', categoria: 'Categoria Inventada', valor_teto: 800 }
    })
    assert.strictEqual(res.statusCode, 400)
})

test('PUT /api/metas exige valor_teto maior que zero', async (t) => {
    const app = await build(t)

    const res = await app.inject({
        method: 'PUT',
        url: '/api/metas',
        payload: { telefone: '5511999999999', categoria: 'Alimentação', valor_teto: 0 }
    })
    assert.strictEqual(res.statusCode, 400)
})

test('PUT /api/metas faz upsert com sucesso', async (t) => {
    const app = await build(t)

    app.db.query = async (sql, params) => {
        assert.match(sql, /INSERT INTO metas .* ON DUPLICATE KEY UPDATE/s)
        assert.deepStrictEqual(params, ['5511999999999', 'Alimentação', 800, 800])
        return [{ affectedRows: 1 }]
    }

    const res = await app.inject({
        method: 'PUT',
        url: '/api/metas',
        payload: { telefone: '5511999999999', categoria: 'Alimentação', valor_teto: 800 }
    })
    assert.strictEqual(res.statusCode, 200)
    assert.strictEqual(res.json().valor_teto, 800)
})

test('DELETE /api/metas/:telefone/:categoria retorna 404 quando não encontra', async (t) => {
    const app = await build(t)

    app.db.query = async () => [{ affectedRows: 0 }]

    const res = await app.inject({ method: 'DELETE', url: '/api/metas/5511999999999/Alimentação' })
    assert.strictEqual(res.statusCode, 404)
})

test('DELETE /api/metas/:telefone/:categoria remove com sucesso', async (t) => {
    const app = await build(t)

    app.db.query = async () => [{ affectedRows: 1 }]

    const res = await app.inject({ method: 'DELETE', url: '/api/metas/5511999999999/Alimentação' })
    assert.strictEqual(res.statusCode, 200)
    assert.strictEqual(res.json().sucesso, true)
})
