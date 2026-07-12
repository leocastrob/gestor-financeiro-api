'use strict'

// Dispara o lançamento da parcela do mês corrente para toda dívida ativa que chegou a sua
// data_primeira_parcela e ainda não tem parcela lançada nesta competência. Roda 1x/dia via PM2 cron-restart (mesmo
// padrão de scripts/backup.sh) — ver instruções de registro no fim deste arquivo.
//
// Decisão de arquitetura: este script NÃO grava direto em `gastos` nem chama o
// WhatsApp diretamente. Ele só decide QUAIS dívidas precisam de parcela hoje (SELECT
// própria, conexão mysql2 independente) e delega o lançamento em si para
// POST /api/dividas/:id/lancar-parcela, que já roda dentro do processo principal.
// Isso evita ter uma segunda sessão do Baileys/WhatsApp (só pode haver uma por vez)
// e evita duplicar a lógica de idempotência/notificação de quitação em dois lugares
// — o endpoint continua sendo a única fonte de verdade.

require('dotenv').config()
const mysql = require('mysql2/promise')

const API_PORT = process.env.API_PORT || 3000

function calcularCompetencia(data) {
    return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`
}

async function main() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        waitForConnections: true,
        connectionLimit: 2,
        queueLimit: 0,
    })

    const competencia = calcularCompetencia(new Date())

    try {
        const [dividas] = await pool.query(
            `SELECT d.id
             FROM dividas d
             WHERE d.ativa = 1
               AND d.data_primeira_parcela <= CURDATE()
               AND NOT EXISTS (
                 SELECT 1 FROM gastos g WHERE g.divida_id = d.id AND g.competencia = ?
               )`,
            [competencia]
        )

        if (dividas.length === 0) {
            console.log(`[lancar-parcelas] Nenhuma dívida pendente para a competência ${competencia}.`)
            return
        }

        console.log(`[lancar-parcelas] ${dividas.length} dívida(s) pendente(s) para ${competencia}.`)

        for (const { id } of dividas) {
            try {
                const resposta = await fetch(`http://127.0.0.1:${API_PORT}/api/dividas/${id}/lancar-parcela`, {
                    method: 'POST',
                })
                const corpo = await resposta.json()
                if (!resposta.ok) {
                    console.error(`[lancar-parcelas] Dívida ${id}: falhou (${resposta.status}) — ${corpo.erro}`)
                    continue
                }
                console.log(`[lancar-parcelas] Dívida ${id}: lançada=${!corpo.jaLancada} quitada=${corpo.quitada}`)
            } catch (erroRequisicao) {
                console.error(`[lancar-parcelas] Dívida ${id}: erro de rede — ${erroRequisicao.message}`)
            }
        }
    } finally {
        await pool.end()
    }
}

if (require.main === module) {
    main().catch((erro) => {
        console.error('[lancar-parcelas] Erro fatal:', erro)
        process.exitCode = 1
    })
}

module.exports = { calcularCompetencia }

// ---------------------------------------------------------------------------
// Registro no PM2 (rodar uma vez no celular, mesmo padrão do scripts/backup.sh):
//   pm2 start scripts/lancar-parcelas.js --name lancar-parcelas \
//     --cron-restart "0 6 * * *" --no-autorestart
// Confirmar depois com: pm2 list (deve aparecer como "stopped" entre execuções,
// igual ao processo "backup-financas" já existente — comportamento esperado de
// --no-autorestart, não é falha).
// ---------------------------------------------------------------------------
