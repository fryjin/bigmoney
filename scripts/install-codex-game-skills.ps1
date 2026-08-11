$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$projectSkillsRoot = Join-Path $projectRoot '.agents\skills'
$developWebGameCommit = '30444aed500c00c85294d12074f6e3ee794f808a'
$higgsfieldCommit = '9db2e5bf22ff93d0bffb48664a8d0d6bb417082c'

function Assert-InstalledSkill {
    param([Parameter(Mandatory = $true)][string]$Name)

    $skillFile = Join-Path (Join-Path $projectSkillsRoot $Name) 'SKILL.md'
    if (-not (Test-Path -LiteralPath $skillFile -PathType Leaf)) {
        throw "Expected project Skill was not installed: $skillFile"
    }
}

function Install-PinnedSkill {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$Repository,
        [Parameter(Mandatory = $true)][string]$Commit,
        [Parameter(Mandatory = $true)][string]$SourcePath
    )

    $temporaryDirectory = Join-Path ([System.IO.Path]::GetTempPath()) ("bigmoney-skill-$Name-" + [Guid]::NewGuid())
    $destination = Join-Path $projectSkillsRoot $Name

    try {
        Write-Host "Installing $Name from $Repository@$Commit..." -ForegroundColor Yellow
        & git clone $Repository $temporaryDirectory
        if ($LASTEXITCODE -ne 0) {
            throw "git clone failed for $Name"
        }

        & git -C $temporaryDirectory checkout --detach $Commit
        if ($LASTEXITCODE -ne 0) {
            throw "git checkout failed for $Name at $Commit"
        }

        $source = Join-Path $temporaryDirectory $SourcePath
        if (-not (Test-Path -LiteralPath (Join-Path $source 'SKILL.md') -PathType Leaf)) {
            throw "Pinned source does not contain SKILL.md: $source"
        }

        if (Test-Path -LiteralPath $destination) {
            Remove-Item -LiteralPath $destination -Recurse -Force
        }
        Copy-Item -LiteralPath $source -Destination $destination -Recurse -Force
        Assert-InstalledSkill -Name $Name
    }
    finally {
        if (Test-Path -LiteralPath $temporaryDirectory) {
            Remove-Item -LiteralPath $temporaryDirectory -Recurse -Force
        }
    }
}

New-Item -ItemType Directory -Path $projectSkillsRoot -Force | Out-Null

$cliSkills = @(
    @{ Repository = 'github/awesome-copilot'; Skill = 'game-engine' },
    @{ Repository = 'Jeffallan/claude-skills'; Skill = 'game-developer' },
    @{ Repository = 'omer-metin/skills-for-antigravity'; Skill = 'game-ui-design' },
    @{ Repository = 'gamedev-skills/awesome-gamedev-agent-skills'; Skill = 'game-ui-ux' }
)

Push-Location -LiteralPath $projectRoot
try {
    foreach ($item in $cliSkills) {
        Write-Host "Installing $($item.Skill) with skills CLI (project scope)..." -ForegroundColor Yellow
        # No --global flag: project scope targets this repository's Codex skill directory.
        & npx.cmd --yes skills add $item.Repository --skill $item.Skill --agent codex --copy --yes
        if ($LASTEXITCODE -ne 0) {
            throw "skills CLI installation failed: $($item.Skill)"
        }
        Assert-InstalledSkill -Name $item.Skill
    }
}
finally {
    Pop-Location
}

Install-PinnedSkill -Name 'develop-web-game' -Repository 'https://github.com/openai/skills.git' -Commit $developWebGameCommit -SourcePath 'skills/.curated/develop-web-game'
Install-PinnedSkill -Name 'higgsfield-game-generation' -Repository 'https://github.com/higgsfield-ai/skills.git' -Commit $higgsfieldCommit -SourcePath 'higgsfield-game-generation'

Write-Host 'Big Money Codex Game Skills installation completed.' -ForegroundColor Green
Write-Host "develop-web-game: openai/skills@$developWebGameCommit" -ForegroundColor Green
Write-Host "higgsfield-game-generation: higgsfield-ai/skills@$higgsfieldCommit" -ForegroundColor Green
