# gestor-financeiro-api

API do meu gestor de gastos pessoal. Recebe mensagens de um bot de WhatsApp (ex: `"50 mercado"`), interpreta valor/descrição, classifica a categoria automaticamente e salva no banco. Expõe endpoints REST para o front-end (`gestor-financeiro-web`) consultar e excluir gastos.

Para uma explicação completa do projeto (o quê, como e onde roda) veja `../PROJETO.md`. Para melhorias planejadas, veja `../MELHORIAS.md`.

## Stack

- Fastify 5 (Node.js)
- MariaDB/MySQL via `mysql2`
- WhatsApp via `@whiskeysockets/baileys`
- `dotenv` para configuração

## Como rodar localmente

1. Ter um MySQL/MariaDB local com um banco `financas` (rode `schema.sql` para criar a estrutura).
2. Copiar `.env.example` para `.env` e ajustar as credenciais do banco.
3. Instalar dependências: `npm install`
4. Rodar em modo desenvolvimento: `npm run dev`
5. Na primeira execução, escaneie o QR Code exibido no terminal com o WhatsApp que vai atuar como bot.

## Variáveis de ambiente

Ver `.env.example`: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`.

## Testes

```
npm test
```

Os testes mockam `fastify.db` — não é necessário um banco real rodando. O plugin do WhatsApp não conecta de verdade durante os testes (`NODE_ENV=test`).

## Deploy

Deploy é feito via `git push prod main` (repositório bare no servidor Termux). Veja o fluxo completo documentado em `../PROJETO.md`.

## Backup do banco

```
./scripts/backup.sh
```

Gera um dump em `backups/` (ignorado pelo Git). Recomendado agendar via cron no servidor.
