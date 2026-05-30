# ─────────────────────────────────────────────────────────────
# Audit-Secrets — detecta archivos .env / secretos en git history
# Uso:    pwsh ./scripts/audit-secrets.ps1
# Salida: lista de archivos .env y posibles secretos por blob
# ─────────────────────────────────────────────────────────────

$ErrorActionPreference = 'Stop'

Write-Host "→ Verificando archivos sensibles en historial..." -ForegroundColor Cyan

$sensitivePatterns = @(
  '\.env$',
  '\.env\..*',
  '\.env\.vercel',
  '\.env\.local',
  'secrets\.json',
  'credentials\.json',
  'service-account\.json'
)

# 1) Archivos sensibles que alguna vez estuvieron en git
Write-Host "`n[1/3] Archivos sensibles que aparecen en algún commit:" -ForegroundColor Yellow
$found = git log --all --pretty=format: --name-only --diff-filter=A 2>$null | Sort-Object -Unique
$dangerFiles = @()
foreach ($f in $found) {
  if (-not $f) { continue }
  foreach ($p in $sensitivePatterns) {
    if ($f -match $p) {
      Write-Host "  ⚠  $f" -ForegroundColor Red
      $dangerFiles += $f
      break
    }
  }
}
if ($dangerFiles.Count -eq 0) {
  Write-Host "  ✓ Ningún archivo sensible detectado" -ForegroundColor Green
}

# 2) Patrones de secretos en blobs
Write-Host "`n[2/3] Escaneando contenido de commits por patrones de secretos..." -ForegroundColor Yellow
$secretPatterns = @{
  'AWS Access Key'      = 'AKIA[0-9A-Z]{16}'
  'Anthropic API Key'   = 'sk-ant-[A-Za-z0-9_-]{40,}'
  'OpenAI API Key'      = 'sk-[A-Za-z0-9]{40,}'
  'Supabase Service Key' = 'eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}'
  'Stripe Live Key'     = 'sk_live_[A-Za-z0-9]{20,}'
  'Culqi Live Secret'   = 'sk_live_[A-Za-z0-9]{20,}'
  'Resend API Key'      = 're_[A-Za-z0-9_]{20,}'
  'Generic Bearer Token' = 'Bearer\s+[A-Za-z0-9._\-]{30,}'
  'Private Key'         = '-----BEGIN [A-Z ]+PRIVATE KEY-----'
}

foreach ($name in $secretPatterns.Keys) {
  $pat = $secretPatterns[$name]
  $hits = git log -p --all -G "$pat" --no-color 2>$null | Select-String -Pattern $pat -AllMatches
  if ($hits) {
    Write-Host "  ⚠  $name: $($hits.Count) coincidencia(s)" -ForegroundColor Red
  } else {
    Write-Host "  ✓ $name" -ForegroundColor Green
  }
}

# 3) Recomendaciones
Write-Host "`n[3/3] Próximos pasos si hay hallazgos:" -ForegroundColor Yellow
@"
  1) ROTAR INMEDIATAMENTE cualquier secreto que aparezca en este reporte.
     - Supabase: Dashboard → Project Settings → API → Reset service_role
     - Culqi:    Dashboard → Configuración → Llaves → Regenerar
     - Resend:   Dashboard → API Keys → Revoke + crear nueva
     - ADMIN_JWT_SECRET: regenerar (invalida todas las sesiones admin)

  2) (Opcional) Reescribir historial con git-filter-repo:
       pip install git-filter-repo
       git filter-repo --invert-paths --path .env.vercel --path .env

  3) Force-push tras coordinarlo con TODOS los colaboradores:
       git push --force-with-lease --all
       git push --force-with-lease --tags

  4) Hacer GitHub support request si el repo es público (caches).

  5) Habilitar GitHub Push Protection (Settings → Code security).
"@
"@

Write-Host "`nListo." -ForegroundColor Cyan
