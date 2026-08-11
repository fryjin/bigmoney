$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$projectSkillsRoot = Join-Path $projectRoot '.agents\skills'
$developWebGameSource = 'openai/skills@30444aed500c00c85294d12074f6e3ee794f808a'
$higgsfieldSource = 'higgsfield-ai/skills@9db2e5bf22ff93d0bffb48664a8d0d6bb417082c'

$skills = @(
    'higgsfield-game-generation',
    'game-engine',
    'game-developer',
    'game-ui-design',
    'game-ui-ux',
    'develop-web-game'
)

$failed = @()
foreach ($skill in $skills) {
    $skillFile = Join-Path (Join-Path $projectSkillsRoot $skill) 'SKILL.md'
    if (Test-Path -LiteralPath $skillFile -PathType Leaf) {
        Write-Host "[PASS] ${skill}: $skillFile" -ForegroundColor Green
    }
    else {
        Write-Host "[FAIL] ${skill}: missing $skillFile" -ForegroundColor Red
        $failed += $skill
    }
}

Write-Host ''
Write-Host 'Pinned skill sources:' -ForegroundColor Cyan
Write-Host "develop-web-game: $developWebGameSource" -ForegroundColor Cyan
Write-Host "higgsfield-game-generation: $higgsfieldSource" -ForegroundColor Cyan
Write-Host ''

if ($failed.Count -eq 0) {
    Write-Host "[PASS] Big Money Codex Game Skills verification: $($skills.Count)/$($skills.Count) SKILL.md files found." -ForegroundColor Green
    exit 0
}

Write-Host "[FAIL] Big Money Codex Game Skills verification: $($skills.Count - $failed.Count)/$($skills.Count) SKILL.md files found." -ForegroundColor Red
exit 1
