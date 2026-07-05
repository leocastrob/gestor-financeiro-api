#!/bin/bash

# ============================================
# 🚀 Deploy do Gestor Financeiro
# Builda o front, copia pro back e faz push
# ============================================

set -e

API="$(cd "$(dirname "$0")" && pwd)"
FRONT="$API/../gestor-financeiro-web"
PUBLIC="$API/public"

echo ""
echo "🔨 Buildando o frontend..."
cd "$FRONT"
npm run build

echo ""
echo "🧹 Limpando pasta public antiga..."
rm -rf "$PUBLIC"/*

echo ""
echo "📦 Copiando dist → public..."
cp -r "$FRONT/dist/"* "$PUBLIC/"

echo ""
echo "📤 Fazendo push da API pro Moto G..."
cd "$API"
git add -A
git commit -m "deploy: atualiza frontend $(date '+%d/%m %H:%M')" 2>/dev/null || echo "⚠️  Sem alterações para commitar"
git push prod main

echo ""
echo "✅ Deploy concluído!"
echo ""
