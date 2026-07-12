'use strict'

const { test } = require('node:test')
const assert = require('node:assert')
const { build } = require('../../helper')

test('POST /api/contas-fixas exige telefone', async (t) => {
    const app = await build(t)

    const res = await app.inject({ method: 'POST', url: '/api/contas-fixas', payload: { descricao: 'Luz', valor: 50, dia_vencimento: 10 } })
    assert.strictEqual(res.statusCode, 400)
    assert.match(res.json().erro, /Telefone é obrigatório/)
})

test('POST /api/contas-fixas cria uma nova conta com sucesso', async (t) => {
    const app = await build(t)

    app.db.query = async (sql, params) => {
        if (/INSERT/.test(sql)) {
            assert.deepStrictEqual(params, ['5511999999999', 'Luz', 'Moradia', 150, 5, 3, 0])
            return [{ insertId: 10 }]
        }
        return [[{ id: 10, telefone: '5511999999999', descricao: 'Luz', categoria: 'Moradia', valor: '150.00', dia_vencimento: 5 }]]
    }

    const res = await app.inject({
        method: 'POST',
        url: '/api/contas-fixas',
        payload: { telefone: '5511999999999', descricao: 'Luz', valor: 150, dia_vencimento: 5 }
    })
    assert.strictEqual(res.statusCode, 201)
    assert.strictEqual(res.json().id, 10)
})

test('GET /api/contas-fixas/:telefone lista as contas e mapeia paga_neste_mes como boolean', async (t) => {
    const app = await build(t)

    app.db.query = async (sql, params) => {
        assert.match(sql, /SELECT c\.\*,/)
        assert.deepStrictEqual(params[1], '5511999999999')
        return [[
            { id: 1, telefone: '5511999999999', descricao: 'Luz', paga_neste_mes: 1 },
            { id: 2, telefone: '5511999999999', descricao: 'Água', paga_neste_mes: 0 }
        ]]
    }

    const res = await app.inject({ method: 'GET', url: '/api/contas-fixas/5511999999999' })
    assert.strictEqual(res.statusCode, 200)
    const contas = res.json()
    assert.strictEqual(contas.length, 2)
    assert.strictEqual(contas[0].paga_neste_mes, true)
    assert.strictEqual(contas[1].paga_neste_mes, false)
})

test('PATCH /api/contas-fixas/:id edita com sucesso', async (t) => {
    const app = await build(t)

    app.db.query = async (sql, params) => {
        if (/SELECT/.test(sql)) {
            return [[{ id: 1 }]]
        }
        assert.match(sql, /UPDATE contas_fixas SET valor = \?, dia_vencimento = \? WHERE id = \? AND telefone = \?/)
        assert.deepStrictEqual(params, [200, 15, '1', '5511999999999'])
        return [{ affectedRows: 1 }]
    }

    const res = await app.inject({
        method: 'PATCH',
        url: '/api/contas-fixas/1',
        payload: { telefone: '5511999999999', valor: 200, dia_vencimento: 15 }
    })
    assert.strictEqual(res.statusCode, 200)
    assert.strictEqual(res.json().sucesso, true)
})

test('DELETE /api/contas-fixas/:id exclui logicamente se já tem gastos lançados', async (t) => {
    const app = await build(t)

    let updateCalled = false
    app.db.query = async (sql, params) => {
        if (sql.includes('SELECT id FROM contas_fixas')) return [[{ id: 1 }]]
        if (sql.includes('SELECT COUNT(*)')) return [[{ total: 5 }]] // Tem gastos
        if (sql.includes('UPDATE contas_fixas SET ativa = 0')) {
            updateCalled = true
            return [{ affectedRows: 1 }]
        }
    }

    const res = await app.inject({
        method: 'DELETE',
        url: '/api/contas-fixas/1',
        payload: { telefone: '5511999999999' }
    })
    assert.strictEqual(res.statusCode, 200)
    assert.strictEqual(updateCalled, true)
    assert.match(res.json().mensagem, /marcada como inativa/)
})

test('POST /api/contas-fixas/:id/lancar lança gasto com idempotência', async (t) => {
    const app = await build(t)

    let insertCount = 0
    app.db.query = async (sql, params) => {
        if (sql.includes('SELECT * FROM contas_fixas')) {
            return [[{ id: 1, telefone: '5511999999999', descricao: 'Luz', valor: 150, categoria: 'Moradia', ativa: 1 }]]
        }
        if (sql.includes('INSERT INTO gastos')) {
            insertCount++
            // Simula erro de duplicação na segunda vez
            if (insertCount === 2) {
                const err = new Error('ER_DUP_ENTRY')
                err.code = 'ER_DUP_ENTRY'
                throw err
            }
            return [{ insertId: 99 }]
        }
    }

    // Primeira chamada: deve inserir
    const res1 = await app.inject({ method: 'POST', url: '/api/contas-fixas/1/lancar' })
    assert.strictEqual(res1.statusCode, 200)
    assert.strictEqual(res1.json().sucesso, true)
    assert.strictEqual(res1.json().jaLancada, false)

    // Segunda chamada: simula duplicação
    const res2 = await app.inject({ method: 'POST', url: '/api/contas-fixas/1/lancar' })
    assert.strictEqual(res2.statusCode, 200)
    assert.strictEqual(res2.json().sucesso, true)
    assert.strictEqual(res2.json().jaLancada, true) // Tratou a duplicação
})
