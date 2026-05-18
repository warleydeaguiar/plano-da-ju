#!/bin/bash
set -e

# ── Verificar que não há mudanças não commitadas ────────────────
if ! git diff-index --quiet HEAD --; then
  echo "❌ Há mudanças não commitadas. Commite antes de deployar."
  exit 1
fi

echo "📤 Pushing para GitHub..."
git push

echo "🚀 Deployando na VPS (187.77.43.98)..."
ssh -i ~/.ssh/konor_vps root@187.77.43.98 "
  set -e
  cd /opt/plano-da-ju

  # Pull latest
  git fetch origin main
  git reset --hard origin/main
  echo '✅ Código atualizado'

  # Build web
  echo '🔨 Buildando web...'
  npm run build:web

  # Build admin
  echo '🔨 Buildando admin...'
  npm run build:admin

  # Restart services
  systemctl reload-or-restart planodaju-web planodaju-admin
  echo '✅ Serviços reiniciados'
"

echo ""
echo "✅ Deploy concluído!"
echo "   Web:   https://planodaju.julianecost.com"
echo "   Admin: https://app.julianecost.com"
