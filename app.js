'use strict'

require('dotenv').config()

const path = require('node:path')
const AutoLoad = require('@fastify/autoload')
const cors = require('@fastify/cors')
const fastifyStatic = require('@fastify/static')

// Pass --options via CLI arguments in command to enable these options.
const options = {}

module.exports = async function (fastify, opts) {
  // Place here your custom code!
  // Do not touch the following lines

  fastify.register(cors, {
    origin: '*'
  })

  // Serve os arquivos estáticos do frontend (pasta public/)
  fastify.register(fastifyStatic, {
    root: path.join(__dirname, 'public'),
    prefix: '/',
  })

  // This loads all plugins defined in plugins
  // those should be support plugins that are reused
  // through your application
  fastify.register(AutoLoad, {
    dir: path.join(__dirname, 'plugins'),
    options: Object.assign({}, opts)
  })

  // This loads all plugins defined in routes
  // define your routes in one of these
  fastify.register(AutoLoad, {
    dir: path.join(__dirname, 'routes'),
    options: Object.assign({}, opts)
  })

  // Catch-all: qualquer rota não encontrada que não seja da API vai retornar o index.html
  // Isso é necessário para o Vue Router funcionar (SPA)
  fastify.setNotFoundHandler((request, reply) => {
    // Se for uma rota de API, retorna 404 normal
    if (request.url.startsWith('/api')) {
      return reply.status(404).send({ erro: 'Rota não encontrada' })
    }
    // Senão, retorna o index.html para o Vue Router resolver
    return reply.sendFile('index.html')
  })
}

module.exports.options = options
