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
            assert.deepStrictEqual(params, ['5511999999999', 'Pensão', '🏷️', 'despesa', null])
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

test('PATCH /api/categorias/:id exige telefone', async (t) => {
    const app = await build(t)
    const res = await app.inject({ method: 'PATCH', url: '/api/categorias/1', payload: { nome: 'Pets' } })
    assert.strictEqual(res.statusCode, 400)
})

test('PATCH /api/categorias/:id rejeita nome vazio', async (t) => {
    const app = await build(t)
    const res = await app.inject({
        method: 'PATCH',
        url: '/api/categorias/1',
        payload: { telefone: '5511999999999', nome: '   ' }
    })
    assert.strictEqual(res.statusCode, 400)
})

test('PATCH /api/categorias/:id retorna 404 se não encontrar', async (t) => {
    const app = await build(t)
    app.db.query = async () => [[]]
    const res = await app.inject({
        method: 'PATCH',
        url: '/api/categorias/1',
        payload: { telefone: '5511999999999', nome: 'Pets' }
    })
    assert.strictEqual(res.statusCode, 404)
})

test('PATCH /api/categorias/:id edita com sucesso', async (t) => {
    const app = await build(t)
    let chamada = 0
    app.db.query = async (sql) => {
        chamada++
        if (chamada === 1) {
            assert.match(sql, /SELECT id FROM categorias_personalizadas WHERE id = \? AND telefone = \?/)
            return [[{ id: 1 }]]
        }
        if (chamada === 2) {
            assert.match(sql, /UPDATE categorias_personalizadas SET nome = \?, icone = \?/)
            return [{}]
        }
        return [[{ id: 1, telefone: '5511999999999', nome: 'Pets', icone: '🐶', tipo: 'despesa' }]]
    }
    const res = await app.inject({
        method: 'PATCH',
        url: '/api/categorias/1',
        payload: { telefone: '5511999999999', nome: 'Pets', icone: '🐶' }
    })
    assert.strictEqual(res.statusCode, 200)
    assert.strictEqual(res.json().nome, 'Pets')
})

test('PATCH /api/categorias/:id rejeita nome duplicado', async (t) => {
    const app = await build(t)
    let chamada = 0
    app.db.query = async () => {
        chamada++
        if (chamada === 1) return [[{ id: 1 }]]
        const erro = new Error('Duplicate entry')
        erro.code = 'ER_DUP_ENTRY'
        throw erro
    }
    const res = await app.inject({
        method: 'PATCH',
        url: '/api/categorias/1',
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

test('POST /api/categorias rejeita cor com formato inválido', async (t) => {
    const app = await build(t)

    const res = await app.inject({
        method: 'POST',
        url: '/api/categorias',
        payload: { telefone: '5511999999999', nome: 'Faculdade', cor: 'vermelho' }
    })
    assert.strictEqual(res.statusCode, 400)
    assert.strictEqual(res.json().erro, 'Cor inválida. Use o formato #RRGGBB.')
})

test('POST /api/categorias grava a cor informada', async (t) => {
    const app = await build(t)

    app.db.query = async (sql, params) => {
        if (/INSERT/.test(sql)) {
            assert.deepStrictEqual(params, ['5511999999999', 'Faculdade', '🏷️', 'despesa', '#db2777'])
            return [{ insertId: 5 }]
        }
        return [[{ id: 5, nome: 'Faculdade', cor: '#db2777' }]]
    }

    const res = await app.inject({
        method: 'POST',
        url: '/api/categorias',
        payload: { telefone: '5511999999999', nome: 'Faculdade', cor: '#db2777' }
    })
    assert.strictEqual(res.statusCode, 201)
})

test('POST /api/categorias sem cor grava NULL', async (t) => {
    const app = await build(t)

    app.db.query = async (sql, params) => {
        if (/INSERT/.test(sql)) {
            assert.deepStrictEqual(params, ['5511999999999', 'Faculdade', '🏷️', 'despesa', null])
            return [{ insertId: 6 }]
        }
        return [[{ id: 6, nome: 'Faculdade', cor: null }]]
    }

    const res = await app.inject({
        method: 'POST',
        url: '/api/categorias',
        payload: { telefone: '5511999999999', nome: 'Faculdade' }
    })
    assert.strictEqual(res.statusCode, 201)
})

test('PATCH /api/categorias/:id rejeita cor com formato inválido', async (t) => {
    const app = await build(t)

    app.db.query = async () => [[{ id: 1 }]]

    const res = await app.inject({
        method: 'PATCH',
        url: '/api/categorias/1',
        payload: { telefone: '5511999999999', cor: '#ZZZ' }
    })
    assert.strictEqual(res.statusCode, 400)
    assert.strictEqual(res.json().erro, 'Cor inválida. Use o formato #RRGGBB.')
})

test('PATCH /api/categorias/:id atualiza a cor', async (t) => {
    const app = await build(t)

    let chamada = 0
    app.db.query = async (sql, params) => {
        chamada++
        if (chamada === 1) return [[{ id: 1 }]]
        if (/UPDATE/.test(sql)) {
            assert.match(sql, /SET cor = \? WHERE id = \? AND telefone = \?/)
            assert.deepStrictEqual(params, ['#0d9488', '1', '5511999999999'])
            return [{ affectedRows: 1 }]
        }
        return [[{ id: 1, cor: '#0d9488' }]]
    }

    const res = await app.inject({
        method: 'PATCH',
        url: '/api/categorias/1',
        payload: { telefone: '5511999999999', cor: '#0d9488' }
    })
    assert.strictEqual(res.statusCode, 200)
    assert.strictEqual(res.json().cor, '#0d9488')
})

test('PATCH /api/categorias/:id com cor null volta para automática', async (t) => {
    const app = await build(t)

    let chamada = 0
    app.db.query = async (sql, params) => {
        chamada++
        if (chamada === 1) return [[{ id: 1 }]]
        if (/UPDATE/.test(sql)) {
            assert.deepStrictEqual(params, [null, '1', '5511999999999'])
            return [{ affectedRows: 1 }]
        }
        return [[{ id: 1, cor: null }]]
    }

    const res = await app.inject({
        method: 'PATCH',
        url: '/api/categorias/1',
        payload: { telefone: '5511999999999', cor: null }
    })
    assert.strictEqual(res.statusCode, 200)
})
