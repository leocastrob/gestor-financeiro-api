'use strict'

const { test } = require('node:test')
const assert = require('node:assert')
const { build } = require('../../helper')

test('POST /api/categorias exige telefone e nome', async (t) => {
    const app = await build(t)

    let res = await app.inject({ method: 'POST', url: '/api/categorias', payload: { nome: 'Pensão' } })
    assert.strictEqual(res.statusCode, 400)
    assert.match(res.json().erro, /Telefone é obrigatório/)

    res = await app.inject({ method: 'POST', url: '/api/categorias', payload: { telefone: '5511999999999' } })
    assert.strictEqual(res.statusCode, 400)
    assert.match(res.json().erro, /nome da categoria é obrigatório/)
})

test('POST /api/categorias rejeita nome muito longo', async (t) => {
    const app = await build(t)
    const res = await app.inject({
        method: 'POST',
        url: '/api/categorias',
        payload: { telefone: '5511999999999', nome: 'A'.repeat(51) }
    })
    assert.strictEqual(res.statusCode, 400)
    assert.match(res.json().erro, /muito longo/)
})

test('POST /api/categorias cria com sucesso (default despesa e emoji)', async (t) => {
    const app = await build(t)

    let chamada = 0
    app.db.query = async (sql, params) => {
        chamada++
        if (chamada === 1) {
            assert.match(sql, /INSERT INTO categorias_personalizadas/)
            assert.deepStrictEqual(params, ['5511999999999', 'Pensão', '🏷️', 'despesa'])
            return [{ insertId: 1 }]
        }
        return [[{ id: 1, telefone: '5511999999999', nome: 'Pensão', icone: '🏷️', tipo: 'despesa' }]]
    }

    const res = await app.inject({
        method: 'POST',
        url: '/api/categorias',
        payload: { telefone: '5511999999999', nome: 'Pensão ' }
    })
    assert.strictEqual(res.statusCode, 201)
    assert.strictEqual(res.json().nome, 'Pensão')
    assert.strictEqual(res.json().icone, '🏷️')
})

test('POST /api/categorias rejeita nome duplicado', async (t) => {
    const app = await build(t)
    app.db.query = async () => {
        const erro = new Error('Duplicate entry')
        erro.code = 'ER_DUP_ENTRY'
        throw erro
    }
    const res = await app.inject({
        method: 'POST',
        url: '/api/categorias',
        payload: { telefone: '5511999999999', nome: 'Pensão' }
    })
    assert.strictEqual(res.statusCode, 409)
})

test('GET /api/categorias/:telefone lista com sucesso', async (t) => {
    const app = await build(t)
    app.db.query = async (sql, params) => {
        assert.match(sql, /SELECT \* FROM categorias_personalizadas WHERE telefone = \?/)
        assert.deepStrictEqual(params, ['5511999999999'])
        return [[{ id: 1, nome: 'Faculdade' }]]
    }
    const res = await app.inject({ method: 'GET', url: '/api/categorias/5511999999999' })
    assert.strictEqual(res.statusCode, 200)
    assert.strictEqual(res.json().length, 1)
})

test('DELETE /api/categorias/:id exige telefone', async (t) => {
    const app = await build(t)
    const res = await app.inject({ method: 'DELETE', url: '/api/categorias/1', payload: {} })
    assert.strictEqual(res.statusCode, 400)
})

test('DELETE /api/categorias/:id retorna 404 se não encontrar', async (t) => {
    const app = await build(t)
    app.db.query = async () => [{ affectedRows: 0 }]
    const res = await app.inject({ method: 'DELETE', url: '/api/categorias/1', payload: { telefone: '5511999999999' } })
    assert.strictEqual(res.statusCode, 404)
})

test('DELETE /api/categorias/:id deleta com sucesso', async (t) => {
    const app = await build(t)
    app.db.query = async () => [{ affectedRows: 1 }]
    const res = await app.inject({ method: 'DELETE', url: '/api/categorias/1', payload: { telefone: '5511999999999' } })
    assert.strictEqual(res.statusCode, 200)
    assert.strictEqual(res.json().sucesso, true)
})
