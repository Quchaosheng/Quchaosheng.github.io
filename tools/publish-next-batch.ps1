[CmdletBinding()]
param(
  [ValidateRange(0, 4)]
  [int]$BatchSize = 0,
  [switch]$WhatIf,
  [switch]$SkipDeploy
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$statePath = Join-Path $repoRoot 'data\publication-queue-state.json'
$nodeBin = 'C:\Users\qucha\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin'
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

Set-Location $repoRoot

function Invoke-Git {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
  & git @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "git $($Arguments -join ' ') failed with exit code $LASTEXITCODE"
  }
}

$worktreeStatus = & git status --porcelain
if ($LASTEXITCODE -ne 0) {
  throw 'Unable to inspect the Git worktree.'
}
if ($worktreeStatus) {
  throw 'Refusing to publish because the worktree is not clean.'
}

Invoke-Git -c http.version=HTTP/1.1 fetch origin source
$remoteDelta = @(((& git rev-list --left-right --count HEAD...origin/source).Trim()) -split '\s+')
if ($remoteDelta.Count -eq 2 -and [int]$remoteDelta[1] -gt 0) {
  throw 'origin/source has newer commits; resolve them before running the publication queue.'
}

$state = Get-Content -Raw -Encoding UTF8 $statePath | ConvertFrom-Json
Invoke-Git show-ref --verify --quiet "refs/heads/$($state.queueBranch)"

$rawChanges = & git diff --name-status "$($state.baselineRef)..$($state.queueBranch)" -- source/_posts
if ($LASTEXITCODE -ne 0) {
  throw 'Unable to read the local publication queue.'
}

$allItems = @()
foreach ($line in $rawChanges) {
  $parts = $line -split "`t"
  if ($parts.Count -ge 2 -and $parts[-1] -like 'source/_posts/*.md') {
    $allItems += [pscustomobject]@{
      Change = $parts[0]
      Path = $parts[-1]
    }
  }
}

$publishedPaths = @($state.published | ForEach-Object { $_.path })
$pending = @($allItems | Where-Object { $publishedPaths -notcontains $_.Path })
if ($pending.Count -eq 0) {
  Write-Output 'The local publication queue is empty.'
  exit 0
}

# New articles become visible first; later batches improve existing notes without changing their original dates.
$ordered = @()
$ordered += @($pending | Where-Object { $_.Change -eq 'A' } | Sort-Object Path)
$ordered += @($pending | Where-Object { $_.Change -ne 'A' } | Sort-Object Path)

if ($BatchSize -eq 0) {
  $BatchSize = if (($state.nextBatch % 2) -eq 0) { 3 } else { 4 }
}
$selected = @($ordered | Select-Object -First $BatchSize)
$releaseBase = Get-Date

if ($WhatIf) {
  $selected | ForEach-Object { Write-Output "$($_.Change)`t$($_.Path)" }
  exit 0
}

for ($index = 0; $index -lt $selected.Count; $index++) {
  $item = $selected[$index]
  Invoke-Git restore "--source=$($state.queueBranch)" --staged --worktree -- $item.Path

  if ($item.Change -eq 'A') {
    $fullPath = Join-Path $repoRoot $item.Path
    $content = [System.IO.File]::ReadAllText($fullPath)
    $releaseTime = $releaseBase.AddMinutes($index * 10).ToString('yyyy-MM-dd HH:mm:ss')
    $content = [regex]::Replace($content, '(?m)^date:\s*.*$', "date: $releaseTime", 1)
    [System.IO.File]::WriteAllText($fullPath, $content, $utf8NoBom)
  }
}

foreach ($item in $selected) {
  $state.published += [pscustomobject]@{
    path = $item.Path
    change = $item.Change
    releasedAt = $releaseBase.ToString('o')
  }
}
$state.nextBatch = [int]$state.nextBatch + 1
$state | ConvertTo-Json -Depth 6 | ForEach-Object {
  [System.IO.File]::WriteAllText($statePath, $_, $utf8NoBom)
}

$pathsToStage = @($selected | ForEach-Object { $_.Path }) + 'data/publication-queue-state.json'
Invoke-Git add -- @pathsToStage

$articleNames = @($selected | ForEach-Object { [System.IO.Path]::GetFileNameWithoutExtension($_.Path) })
Invoke-Git commit -m "Publish daily article batch: $($articleNames -join ', ')"
Invoke-Git -c http.version=HTTP/1.1 push origin source

if (-not $SkipDeploy) {
  if (Test-Path $nodeBin) {
    $env:Path = "$nodeBin;$env:Path"
  }
  & .\node_modules\.bin\hexo.cmd clean
  if ($LASTEXITCODE -ne 0) { throw 'Hexo clean failed.' }
  & .\node_modules\.bin\hexo.cmd generate
  if ($LASTEXITCODE -ne 0) { throw 'Hexo generate failed.' }
  & .\node_modules\.bin\hexo.cmd deploy
  if ($LASTEXITCODE -ne 0) { throw 'Hexo deploy failed.' }
}

Write-Output "Published $($selected.Count) article(s): $($articleNames -join ', ')"
