'use strict'

const { test } = require('node:test')
const assert = require('node:assert')
const { build } = require('../../helper')

test('POST /api/gastos exige telefone', async (t) => {
    const app = await build(t)

    const res = await app.inject({ method: 'POST', url: '/api/gastos', payload: { descricao: 'mercado', valor: 50 } })
    assert.strictEqual(res.statusCode, 400)
})

test('POST /api/gastos exige descrição', async (t) => {
    const app = await build(t)

    const res = await app.inject({
        method: 'POST',
        url: '/api/gastos',
        payload: { telefone: '5511999999999', valor: 50 }
    })
    assert.strictEqual(res.statusCode, 400)
})

test('POST /api/gastos exige valor maior que zero', async (t) => {
    const app = await build(t)

    const res = await app.inject({
        method: 'POST',
        url: '/api/gastos',
        payload: { telefone: '5511999999999', descricao: 'mercado', valor: 0 }
    })
    assert.strictEqual(res.statusCode, 400)
})

test('POST /api/gastos rejeita categoria inválida', async (t) => {
    const app = await build(t)

    const res = await app.inject({
        method: 'POST',
        url: '/api/gastos',
        payload: { telefone: '5511999999999', descricao: 'mercado', valor: 50, categoria: 'Categoria Inventada' }
    })
    assert.strictEqual(res.statusCode, 400)
})

test('POST /api/gastos categoriza automaticamente quando a categoria não é informada', async (t) => {
    const app = await build(t)

    let chamada = 0
    app.db.query = async (sql, params) => {
        chamada++
        if (chamada === 1) {
            assert.match(sql, /INSERT INTO gastos/)
            assert.deepStrictEqual(params, ['5511999999999', 'mercado', 50, 'Alimentação', 'despesa'])
            return [{ insertId: 42 }]
        }
        assert.match(sql, /SELECT \* FROM gastos WHERE id = \?/)
        assert.deepStrictEqual(params, [42])
        return [[{ id: 42, telefone: '5511999999999', descricao: 'mercado', valor: '50.00', categoria: 'Alimentação' }]]
    }

    const res = await app.inject({
        method: 'POST',
        url: '/api/gastos',
        payload: { telefone: '5511999999999', descricao: 'mercado', valor: 50 }
    })
    assert.strictEqual(res.statusCode, 201)
    assert.strictEqual(res.json().categoria, 'Alimentação')
})

test('POST /api/gastos respeita a categoria informada manualmente', async (t) => {
    const app = await build(t)

    app.db.query = async (sql, params) => {
        if (/INSERT/.test(sql)) {
            assert.deepStrictEqual(params, ['5511999999999', 'presente', 100, 'Lazer', 'despesa'])
            return [{ insertId: 7 }]
        }
        return [[{ id: 7, telefone: '5511999999999', descricao: 'presente', valor: '100.00', categoria: 'Lazer' }]]
    }

    const res = await app.inject({
        method: 'POST',
        url: '/api/gastos',
        payload: { telefone: '5511999999999', descricao: 'presente', valor: 100, categoria: 'Lazer' }
    })
    assert.strictEqual(res.statusCode, 201)
    assert.strictEqual(res.json().categoria, 'Lazer')
})

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

test('PATCH /api/gastos/:id exige telefone no corpo', async (t) => {
    const app = await build(t)

    const res = await app.inject({ method: 'PATCH', url: '/api/gastos/1', payload: { descricao: 'x' } })
    assert.strictEqual(res.statusCode, 400)
})

test('PATCH /api/gastos/:id rejeita categoria inválida', async (t) => {
    const app = await build(t)

    const res = await app.inject({
        method: 'PATCH',
        url: '/api/gastos/1',
        payload: { telefone: '5511999999999', categoria: 'Categoria Inventada' }
    })
    assert.strictEqual(res.statusCode, 400)
})

test('PATCH /api/gastos/:id retorna 404 quando não encontra o gasto', async (t) => {
    const app = await build(t)

    app.db.query = async () => [{ affectedRows: 0 }]

    const res = await app.inject({
        method: 'PATCH',
        url: '/api/gastos/999',
        payload: { telefone: '5511999999999', descricao: 'novo' }
    })
    assert.strictEqual(res.statusCode, 404)
})

test('PATCH /api/gastos/:id edita com sucesso', async (t) => {
    const app = await build(t)

    app.db.query = async (sql, params) => {
        assert.match(sql, /UPDATE gastos SET descricao = \?, categoria = \? WHERE id = \? AND telefone = \?/)
        assert.deepStrictEqual(params, ['uber eats', 'Alimentação', '1', '5511999999999'])
        return [{ affectedRows: 1 }]
    }

    const res = await app.inject({
        method: 'PATCH',
        url: '/api/gastos/1',
        payload: { telefone: '5511999999999', descricao: 'uber eats', categoria: 'Alimentação' }
    })
    assert.strictEqual(res.statusCode, 200)
    assert.strictEqual(res.json().sucesso, true)
})
