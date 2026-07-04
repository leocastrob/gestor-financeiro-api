'use strict'
const fp = require('fastify-plugin')
const mysql = require('mysql2/promise')

module.exports = fp(async function (fastify, opts) {
    // Cria um pool de conexões (melhor performance que createConnection)
    const pool = mysql.createPool({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'financas',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    })

    // Torna o banco acessível em toda a aplicação através de "fastify.db"
    fastify.decorate('db', pool)
})