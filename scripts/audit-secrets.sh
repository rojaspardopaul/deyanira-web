#!/usr/bin/env bash
# Audit-Secrets — detecta archivos .env / secretos en git history (Linux/Mac).
# Uso: bash scripts/audit-secrets.sh
set -euo pipefail

red()    { printf '\e[31m%s\e[0m\n' "$*"; }
green()  { printf '\e[32m%s\e[0m\n' "$*"; }
yellow() { printf '\e[33m%s\e[0m\n' "$*"; }
cyan()   { printf '\e[36m%s\e[0m\n' "$*"; }

cyan "→ Verificando archivos sensibles en historial..."

PATTERNS=(
  '\.env$'
  '\.env\..*'
  '\.env\.vercel'
  '\.env\.local'
  'secrets\.json'
  'credentials\.json'
  'service-account\.json'
)

yellow "[1/3] Archivos sensibles que aparecen en algún commit:"
FILES=$(git log --all --pretty=format: --name-only --diff-filter=A 2>/dev/null | sort -u | grep -v '^$' || true)
FOUND_ANY=0
while IFS= read -r f; do
  [ -z "$f" ] && continue
  for p in "${PATTERNS[@]}"; do
    if [[ "$f" =~ $p ]]; then
      red "  ⚠  $f"
      FOUND_ANY=1
      break
    fi
  done
done <<< "$FILES"
[ "$FOUND_ANY" -eq 0 ] && green "  ✓ Ningún archivo sensible detectado"

yellow ""
yellow "[2/3] Escaneando contenido de commits por patrones de secretos..."
declare -A SECRET_PATTERNS=(
  [AWS_Access_Key]='AKIA[0-9A-Z]{16}'
  [Anthropic_API_Key]='sk-ant-[A-Za-z0-9_-]{40,}'
  [OpenAI_API_Key]='sk-[A-Za-z0-9]{40,}'
  [Stripe_Live_Key]='sk_live_[A-Za-z0-9]{20,}'
  [Culqi_Live_Secret]='sk_live_[A-Za-z0-9]{20,}'
  [Resend_API_Key]='re_[A-Za-z0-9_]{20,}'
  [Private_Key]='-----BEGIN [A-Z ]+PRIVATE KEY-----'
)
for name in "${!SECRET_PATTERNS[@]}"; do
  pat="${SECRET_PATTERNS[$name]}"
  hits=$(git log -p --all -G "$pat" --no-color 2>/dev/null | grep -cE "$pat" || true)
  if [ "${hits:-0}" -gt 0 ]; then
    red "  ⚠  $name: $hits coincidencia(s)"
  else
    green "  ✓ $name"
  fi
done

yellow ""
yellow "[3/3] Si hay hallazgos:"
cat <<'EOF'
  1) ROTAR INMEDIATAMENTE el secreto comprometido.
  2) Reescribir historial:
       pip install git-filter-repo
       git filter-repo --invert-paths --path .env.vercel --path .env
  3) git push --force-with-lease --all && git push --force-with-lease --tags
  4) Habilitar GitHub Push Protection.
EOF

cyan ""
cyan "Listo."
