<#
.SYNOPSIS
    commit-and-push.ps1
.DESCRIPTION
    Commit et push en une commande : sync .env.preview vers Vercel (preview), git add/commit/push, puis tests API déployée.
    Usage: .\scripts\commit-and-push.ps1 "message de commit"
           .\scripts\commit-and-push.ps1 -Production "message"  # + vercel --prod (déploiement production)
#>

param(
    [switch]$Production   # Si présent : lancer vercel --prod après le push. Sinon : preview/prod via Git (merge vers main = prod).
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
. "$ScriptDir\lib-output.ps1"

$Root = Split-Path -Parent $ScriptDir
Set-Location $Root

$Message = $args -join " "
if (-not $Message.Trim()) {
    $Message = "chore: update"
}

$CurrentBranch = git rev-parse --abbrev-ref HEAD 2>$null
Write-Banner "COMMIT & PUSH"
Write-Info "Message: $Message"
Write-Info "Branche: $CurrentBranch (push -> Vercel $(if ($CurrentBranch -eq 'main') { 'Production' } else { 'Preview' }))"
Write-Info "Racine: $Root"
if ($Production) {
    Write-Info "Deploiement Vercel : PRODUCTION force (vercel --prod)."
} else {
    Write-Info "Deploiement Vercel : non lance (preview/prod via Git). -Production pour forcer la prod."
}

# --- Etape 0 : Branche sur origin (push si pas encore poussee, pour que Vercel trouve la branche preview)
Write-EtapeHeader -Numero 0 -Titre "Branche sur origin" -Pourquoi "Pousser la branche vers origin si elle n'existe pas encore (evite branch_not_found sur Vercel)."
$RemoteRef = git ls-remote --heads origin $CurrentBranch 2>$null
if (-not $RemoteRef) {
    Write-Step "git push -u origin $CurrentBranch (premiere fois)..."
    git push -u origin $CurrentBranch
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "Push de la branche vers origin a echoue."
        exit 1
    }
    Write-Success "Branche $CurrentBranch poussee vers origin."
} else {
    Write-Info "Branche $CurrentBranch deja sur origin."
}

# --- Etape 1 : Sync .env.preview vers Vercel (preview) + .env.example
Write-EtapeHeader -Numero 1 -Titre "Sync env (preview)" -Pourquoi "Pousser .env.preview vers Vercel (preview) et mettre a jour .env.example."
Write-Step "npm run env:sync..."
npm run env:sync
if ($LASTEXITCODE -ne 0) {
    Write-Fail "env:sync a echoue (ex. .env.preview absent ou vercel non lie)."
    exit 1
}
Write-Success "Sync terminee."

# --- Etape 2 : Git (add, commit, push)
Write-EtapeHeader -Numero 2 -Titre "Git" -Pourquoi "Enregistrer les changements et pousser vers l'origine (pre-push lance env:sync)."
Write-Step "git add -A..."
git add -A
Write-Step "git commit..."
git commit -m $Message
$CommitFailed = ($LASTEXITCODE -ne 0)
if ($CommitFailed) {
    Write-Fail "Commit echoue (rien a committer ou erreur)."
    $PushFailed = $true
} else {
    Write-Step "git push..."
    git push
    $PushFailed = ($LASTEXITCODE -ne 0)
    if ($PushFailed) {
        Write-Fail "Push echoue."
    } else {
        Write-Success "Commit et push termines."
    }
}

# --- Etape 3 : Deploiement Vercel (optionnel)
$DeployFailed = $false
$DeployMode = if ($Production) { "prod" } else { "none" }
if ($DeployMode -eq "none") {
    Write-EtapeHeader -Numero 3 -Titre "Deploiement" -Pourquoi "Non lance. Preview/prod via Git. -Production pour forcer vercel --prod."
    Write-Info "Etape 3 ignoree."
} else {
    Write-EtapeHeader -Numero 3 -Titre "Deploiement production" -Pourquoi "vercel --prod."
    Write-Step "npx vercel --prod --yes..."
    npx vercel --prod --yes
    $DeployFailed = ($LASTEXITCODE -ne 0)
    if ($DeployFailed) {
        Write-Fail "Deploiement production echoue."
    } else {
        Write-Success "Deploiement production termine."
    }
}

# --- Etape 4 : Tests API déployée
Write-EtapeHeader -Numero 4 -Titre "Tests API déployée" -Pourquoi "Verifier health + chat sur l'URL déployée (.env.preview)."
Write-Step "npm run test:api:prod..."
npm run test:api:prod
$TestsFailed = ($LASTEXITCODE -ne 0)
if ($TestsFailed) {
    Write-Fail "Tests post-deploiement en echec."
} else {
    Write-Success "Tests post-deploiement OK."
}

# Bilan final
$DeployLabel = if ($DeployMode -eq "prod") { "PROD" } else { "SKIP" }
$DeployStatus = if ($DeployMode -eq "none") { "SKIP" } elseif ($DeployFailed) { "ECHEC" } else { "OK" }
Write-Host ""
Write-DashLine
if ($PushFailed) {
    Write-Host "  Push: ECHEC | Deploiement ($DeployLabel): $DeployStatus | Tests: $(if ($TestsFailed) { 'ECHEC' } else { 'OK' })" -ForegroundColor Red
} elseif ($DeployFailed -or $TestsFailed) {
    Write-Host "  Push: OK | Deploiement ($DeployLabel): $DeployStatus | Tests: $(if ($TestsFailed) { 'ECHEC' } else { 'OK' })" -ForegroundColor Yellow
} else {
    Write-Host "  Push: OK | Deploiement ($DeployLabel): $DeployStatus | Tests: OK" -ForegroundColor Green
}
Write-DashLine

if ($PushFailed) { exit 1 }
if ($DeployMode -ne "none" -and $DeployFailed) { exit 1 }
if ($TestsFailed) { exit 1 }
