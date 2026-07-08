'use strict'

const { test } = require('node:test')
const assert = require('node:assert')
const { build } = require('../../helper')

test('POST /api/auth/solicitar-pin rejeita telefone inválido', async (t) => {
    const app = await build(t)

    const res = await app.inject({ method: 'POST', url: '/api/auth/solicitar-pin', payload: { telefone: 'abc' } })
    assert.strictEqual(res.statusCode, 400)
})

test('POST /api/auth/solicitar-pin envia o código pelo WhatsApp', async (t) => {
    const app = await build(t)

    let mensagemEnviada = null
    app.whatsapp.enviarMensagem = async (telefone, texto) => {
        mensagemEnviada = { telefone, texto }
    }

    const res = await app.inject({ method: 'POST', url: '/api/auth/solicitar-pin', payload: { telefone: '5511999999999' } })
    assert.strictEqual(res.statusCode, 200)
    assert.strictEqual(res.json().sucesso, true)
    assert.strictEqual(mensagemEnviada.telefone, '5511999999999')
    assert.match(mensagemEnviada.texto, /\d{6}/)
})

test('POST /api/auth/solicitar-pin bloqueia pedidos repetidos em menos de 30s', async (t) => {
    const app = await build(t)
    app.whatsapp.enviarMensagem = async () => {}

    await app.inject({ method: 'POST', url: '/api/auth/solicitar-pin', payload: { telefone: '5511999999999' } })
    const res = await app.inject({ method: 'POST', url: '/api/auth/solicitar-pin', payload: { telefone: '5511999999999' } })
    assert.strictEqual(res.statusCode, 429)
})

test('POST /api/auth/solicitar-pin retorna 502 se o envio pelo WhatsApp falhar', async (t) => {
    const app = await build(t)
    app.whatsapp.enviarMensagem = async () => { throw new Error('WhatsApp não está conectado no momento.') }

    const res = await app.inject({ method: 'POST', url: '/api/auth/solicitar-pin', payload: { telefone: '5511999999999' } })
    assert.strictEqual(res.statusCode, 502)
})

test('POST /api/auth/confirmar-pin confirma o fluxo completo', async (t) => {
    const app = await build(t)

    let pinEnviado = null
    app.whatsapp.enviarMensagem = async (telefone, texto) => {
        pinEnviado = texto.match(/\d{6}/)[0]
    }

    await app.inject({ method: 'POST', url: '/api/auth/solicitar-pin', payload: { telefone: '5511999999999' } })

    const resErrado = await app.inject({
        method: 'POST',
        url: '/api/auth/confirmar-pin',
        payload: { telefone: '5511999999999', pin: '000000' }
    })
    assert.strictEqual(resErrado.statusCode, 400)

    const resCerto = await app.inject({
        method: 'POST',
        url: '/api/auth/confirmar-pin',
        payload: { telefone: '5511999999999', pin: pinEnviado }
    })
    assert.strictEqual(resCerto.statusCode, 200)
    assert.strictEqual(resCerto.json().sucesso, true)

    // PIN é de uso único: confirmar de novo com o mesmo código deve falhar
    const resReuso = await app.inject({
        method: 'POST',
        url: '/api/auth/confirmar-pin',
        payload: { telefone: '5511999999999', pin: pinEnviado }
    })
    assert.strictEqual(resReuso.statusCode, 400)
})

test('POST /api/auth/confirmar-pin bloqueia após muitas tentativas erradas', async (t) => {
    const app = await build(t)
    app.whatsapp.enviarMensagem = async () => {}

    await app.inject({ method: 'POST', url: '/api/auth/solicitar-pin', payload: { telefone: '5511988887777' } })

    let ultimaResposta
    for (let i = 0; i < 5; i++) {
        ultimaResposta = await app.inject({
            method: 'POST',
            url: '/api/auth/confirmar-pin',
            payload: { telefone: '5511988887777', pin: '000000' }
        })
    }

    assert.strictEqual(ultimaResposta.statusCode, 400)
    assert.match(ultimaResposta.json().erro, /Muitas tentativas|Nenhum código/)
})
