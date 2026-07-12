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

test('POST /api/dividas rejeita categoria maior que 50 caracteres', async (t) => {
    const app = await build(t)
    const res = await app.inject({
        method: 'POST',
        url: '/api/dividas',
        payload: { telefone: '5511999999999', descricao: 'Geladeira em 10x', categoria: 'A'.repeat(51), valor_parcela: 150, total_parcelas: 10, data_primeira_parcela: '2026-08-01' }
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

test('PATCH /api/dividas/:id exige telefone', async (t) => {
    const app = await build(t)
    const res = await app.inject({
        method: 'PATCH',
        url: '/api/dividas/1',
        payload: { descricao: 'Nova descrição' }
    })
    assert.strictEqual(res.statusCode, 400)
})

test('PATCH /api/dividas/:id retorna 404 quando a dívida não pertence ao telefone', async (t) => {
    const app = await build(t)
    app.db.query = async () => [[]]
    const res = await app.inject({
        method: 'PATCH',
        url: '/api/dividas/1',
        payload: { telefone: '5511999999999', descricao: 'Nova descrição' }
    })
    assert.strictEqual(res.statusCode, 404)
})

test('PATCH /api/dividas/:id bloqueia total_parcelas/data_primeira_parcela quando já há parcela lançada', async (t) => {
    const app = await build(t)
    let chamada = 0
    app.db.query = async (sql) => {
        chamada++
        if (chamada === 1) {
            assert.match(sql, /SELECT id FROM dividas WHERE id = \? AND telefone = \?/)
            return [[{ id: 1 }]]
        }
        assert.match(sql, /SELECT COUNT\(\*\) AS total FROM gastos WHERE divida_id = \?/)
        return [[{ total: 3 }]]
    }
    const res = await app.inject({
        method: 'PATCH',
        url: '/api/dividas/1',
        payload: { telefone: '5511999999999', total_parcelas: 20 }
    })
    assert.strictEqual(res.statusCode, 400)
})

test('PATCH /api/dividas/:id permite editar valor_parcela mesmo com parcelas já lançadas', async (t) => {
    const app = await build(t)
    let chamada = 0
    app.db.query = async (sql, params) => {
        chamada++
        if (chamada === 1) return [[{ id: 1 }]]
        if (chamada === 2) return [[{ total: 3 }]]
        assert.match(sql, /UPDATE dividas SET valor_parcela = \? WHERE id = \? AND telefone = \?/)
        assert.deepStrictEqual(params, [200, '1', '5511999999999'])
        return [{ affectedRows: 1 }]
    }
    const res = await app.inject({
        method: 'PATCH',
        url: '/api/dividas/1',
        payload: { telefone: '5511999999999', valor_parcela: 200 }
    })
    assert.strictEqual(res.statusCode, 200)
    assert.strictEqual(res.json().sucesso, true)
})

test('DELETE /api/dividas/:id exige telefone', async (t) => {
    const app = await build(t)
    const res = await app.inject({ method: 'DELETE', url: '/api/dividas/1', payload: {} })
    assert.strictEqual(res.statusCode, 400)
})

test('DELETE /api/dividas/:id faz hard delete quando não há parcela lançada', async (t) => {
    const app = await build(t)
    let chamada = 0
    app.db.query = async (sql) => {
        chamada++
        if (chamada === 1) return [[{ id: 1 }]]
        if (chamada === 2) return [[{ total: 0 }]]
        assert.match(sql, /DELETE FROM dividas WHERE id = \?/)
        return [{ affectedRows: 1 }]
    }
    const res = await app.inject({
        method: 'DELETE',
        url: '/api/dividas/1',
        payload: { telefone: '5511999999999' }
    })
    assert.strictEqual(res.statusCode, 200)
    assert.match(res.json().mensagem, /excluída/)
})

test('DELETE /api/dividas/:id faz soft delete (ativa=0) quando já há parcela lançada', async (t) => {
    const app = await build(t)
    let chamada = 0
    app.db.query = async (sql) => {
        chamada++
        if (chamada === 1) return [[{ id: 1 }]]
        if (chamada === 2) return [[{ total: 4 }]]
        assert.match(sql, /UPDATE dividas SET ativa = 0 WHERE id = \?/)
        return [{ affectedRows: 1 }]
    }
    const res = await app.inject({
        method: 'DELETE',
        url: '/api/dividas/1',
        payload: { telefone: '5511999999999' }
    })
    assert.strictEqual(res.statusCode, 200)
    assert.match(res.json().mensagem, /inativa/)
})

test('POST /api/dividas/:id/lancar-parcela retorna 404 quando a dívida não existe', async (t) => {
    const app = await build(t)
    app.db.query = async () => [[]]
    const res = await app.inject({ method: 'POST', url: '/api/dividas/1/lancar-parcela' })
    assert.strictEqual(res.statusCode, 404)
})

test('POST /api/dividas/:id/lancar-parcela retorna 400 quando a dívida já está quitada', async (t) => {
    const app = await build(t)
    app.db.query = async () => [[{ id: 1, ativa: 0, telefone: '5511999999999', descricao: 'Geladeira', valor_parcela: '150.00', categoria: 'Outros', total_parcelas: 10 }]]
    const res = await app.inject({ method: 'POST', url: '/api/dividas/1/lancar-parcela' })
    assert.strictEqual(res.statusCode, 400)
})

test('POST /api/dividas/:id/lancar-parcela lança a parcela e retorna quitada=false quando ainda falta parcela', async (t) => {
    const app = await build(t)
    let chamada = 0
    app.db.query = async (sql, params) => {
        chamada++
        if (chamada === 1) {
            assert.match(sql, /SELECT \* FROM dividas WHERE id = \?/)
            return [[{ id: 1, ativa: 1, telefone: '5511999999999', descricao: 'Geladeira em 10x', valor_parcela: '150.00', categoria: 'Outros', total_parcelas: 10 }]]
        }
        if (chamada === 2) {
            assert.match(sql, /SELECT COUNT\(\*\) AS total FROM gastos WHERE divida_id = \?/)
            return [[{ total: 3 }]]
        }
        assert.match(sql, /INSERT INTO gastos/)
        assert.strictEqual(params[1], 'Geladeira em 10x (parcela 4/10)')
        assert.strictEqual(params[4], 'despesa')
        return [{ insertId: 99 }]
    }
    const res = await app.inject({ method: 'POST', url: '/api/dividas/1/lancar-parcela' })
    assert.strictEqual(res.statusCode, 200)
    assert.deepStrictEqual(res.json(), { sucesso: true, jaLancada: false, quitada: false })
})

test('POST /api/dividas/:id/lancar-parcela é idempotente (ER_DUP_ENTRY vira jaLancada=true)', async (t) => {
    const app = await build(t)
    let chamada = 0
    app.db.query = async () => {
        chamada++
        if (chamada === 1) return [[{ id: 1, ativa: 1, telefone: '5511999999999', descricao: 'Geladeira', valor_parcela: '150.00', categoria: 'Outros', total_parcelas: 10 }]]
        if (chamada === 2) return [[{ total: 3 }]]
        const erro = new Error('Duplicate entry')
        erro.code = 'ER_DUP_ENTRY'
        throw erro
    }
    const res = await app.inject({ method: 'POST', url: '/api/dividas/1/lancar-parcela' })
    assert.strictEqual(res.statusCode, 200)
    assert.deepStrictEqual(res.json(), { sucesso: true, jaLancada: true, quitada: false })
})

test('POST /api/dividas/:id/lancar-parcela marca ativa=0 e tenta notificar quando quitada', async (t) => {
    const app = await build(t)
    let chamada = 0
    let updateChamado = false
    app.db.query = async (sql) => {
        chamada++
        if (chamada === 1) return [[{ id: 1, ativa: 1, telefone: '5511999999999', descricao: 'Geladeira', valor_parcela: '150.00', categoria: 'Outros', total_parcelas: 10 }]]
        if (chamada === 2) return [[{ total: 9 }]]
        if (chamada === 3) return [{ insertId: 100 }]
        updateChamado = true
        assert.match(sql, /UPDATE dividas SET ativa = 0 WHERE id = \?/)
        return [{ affectedRows: 1 }]
    }
    const res = await app.inject({ method: 'POST', url: '/api/dividas/1/lancar-parcela' })
    assert.strictEqual(res.statusCode, 200)
    assert.deepStrictEqual(res.json(), { sucesso: true, jaLancada: false, quitada: true })
    assert.strictEqual(updateChamado, true)
})
