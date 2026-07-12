'use strict'

require('dotenv').config()
const mysql = require('mysql2/promise')
const { calcularCompetencia } = require('./lancar-parcelas')

const API_PORT = process.env.API_PORT || 3000

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

    const hoje = new Date()
    const competencia = calcularCompetencia(hoje)

    // Dia do mês (1-31). Lida com o fato de que meses têm tamanhos diferentes.
    // Se hoje é o último dia do mês (ex: 28, 30 ou 31), contas com dia_vencimento
    // maior que o dia atual também devem ser puxadas, para não pularmos o vencimento
    // delas (ex: conta vence dia 31, mas o mês só tem 30 dias).
    // O dia "alvo" é o dia atual. O lembrete avisa dias ANTES.
    // Assim: hoje.getDate() + dias_lembrete_antes == dia_vencimento
    
    try {
        // Encontra todas as contas ativas que não foram lançadas neste mês
        const [contas] = await pool.query(
            `SELECT c.id, c.dia_vencimento, c.dias_lembrete_antes
             FROM contas_fixas c
             WHERE c.ativa = 1
               AND NOT EXISTS (
                 SELECT 1 FROM gastos g WHERE g.conta_fixa_id = c.id AND g.competencia = ?
               )`,
            [competencia]
        )

        const diaAtual = hoje.getDate()
        // Pega o último dia do mês corrente
        const ultimoDiaMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate()

        const contasParaNotificar = contas.filter(conta => {
            // Qual o dia real do vencimento neste mês? (limitado ao último dia do mês)
            const vencimentoReal = Math.min(conta.dia_vencimento, ultimoDiaMes)
            
            // Quando deve ser enviado o lembrete?
            const diaLembrete = vencimentoReal - conta.dias_lembrete_antes
            
            // Se o diaLembrete for menor ou igual a 1, limita a 1
            // Mas a regra mais correta é: se hoje é O DIA EXATO do lembrete, ou já passou (em caso de atraso/feriado)
            // Para ser exato e não enviar múltiplos, checamos diaAtual == diaLembrete
            // E caso a conta esteja atrasada (diaAtual > vencimentoReal) não envia notificação diária
            // Para simplificar, enviaremos apenas quando diaAtual == diaLembrete.
            
            return diaAtual === diaLembrete
        })

        if (contasParaNotificar.length === 0) {
            console.log(`[lancar-recorrentes] Nenhuma conta fixa para notificar/lançar hoje (${diaAtual}).`)
            return
        }

        console.log(`[lancar-recorrentes] ${contasParaNotificar.length} conta(s) fixa(s) engatilhada(s) hoje.`)

        for (const { id } of contasParaNotificar) {
            try {
                const resposta = await fetch(`http://127.0.0.1:${API_PORT}/api/contas-fixas/${id}/notificar`, {
                    method: 'POST',
                })
                const corpo = await resposta.json()
                if (!resposta.ok) {
                    console.error(`[lancar-recorrentes] Conta ${id}: falhou (${resposta.status}) — ${corpo.erro}`)
                    continue
                }
                console.log(`[lancar-recorrentes] Conta ${id}: notificada/lançada com sucesso.`)
            } catch (erroRequisicao) {
                console.error(`[lancar-recorrentes] Conta ${id}: erro de rede — ${erroRequisicao.message}`)
            }
        }
    } finally {
        await pool.end()
    }
}

if (require.main === module) {
    main().catch((erro) => {
        console.error('[lancar-recorrentes] Erro fatal:', erro)
        process.exitCode = 1
    })
}

// ---------------------------------------------------------------------------
// Registro no PM2:
//   pm2 start scripts/lancar-recorrentes.js --name lancar-recorrentes \
//     --cron-restart "0 7 * * *" --no-autorestart
// ---------------------------------------------------------------------------
