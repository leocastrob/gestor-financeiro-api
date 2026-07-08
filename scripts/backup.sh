#!/bin/bash
# Faz um dump do banco "financas" com data no nome do arquivo.
# Uso local: ./scripts/backup.sh
# No servidor (Termux), agende via cron/termux-job-scheduler para rodar sozinho.

set -e

DIR_BACKUP="$(dirname "$0")/../backups"
DATA=$(date +%Y-%m-%d_%H-%M)
ARQUIVO="$DIR_BACKUP/financas_$DATA.sql"

mkdir -p "$DIR_BACKUP"

mysqldump -u "${DB_USER:-root}" ${DB_PASSWORD:+-p"$DB_PASSWORD"} "${DB_NAME:-financas}" > "$ARQUIVO"

echo "Backup salvo em: $ARQUIVO"

# Mantém só os últimos 14 backups locais (evita encher o armazenamento do celular)
ls -1t "$DIR_BACKUP"/financas_*.sql 2>/dev/null | tail -n +15 | xargs -r rm --
