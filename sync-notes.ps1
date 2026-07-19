[CmdletBinding()]
param(
    [string]$Inbox = (Join-Path $env:USERPROFILE 'Desktop\Quchaosheng-Notes'),
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $MyInvocation.MyCommand.Path
$publishScript = Join-Path $repo 'publish.sh'

# Prefer the Bash shipped with Git for Windows. The `bash.exe` on PATH can be
# the WSL launcher, which cannot run this Windows working tree reliably.
$git = Get-Command git.exe -ErrorAction SilentlyContinue | Select-Object -First 1
$bashCandidates = @()
if ($git) {
    $gitRoot = Split-Path (Split-Path $git.Source -Parent) -Parent
    $bashCandidates += Join-Path $gitRoot 'bin\bash.exe'
}
$bashCandidates += Get-Command bash.exe -All -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty Source
$bash = $bashCandidates |
    Where-Object { $_ -and (Test-Path -LiteralPath $_) -and $_ -notmatch '\\Windows\\System32\\bash\.exe$' } |
    Select-Object -First 1

if (-not $bash) {
    throw '没有找到 Git Bash，请安装 Git for Windows。'
}
if (-not (Test-Path -LiteralPath $publishScript)) {
    throw "找不到发布脚本：$publishScript"
}
if (-not (Test-Path -LiteralPath $Inbox)) {
    throw "找不到笔记文件夹：$Inbox"
}

function Get-CategorySpec([string]$Path) {
    $relative = $Path.Substring($Inbox.Length).TrimStart('\', '/')
    $parts = $relative -split '[\\/]'

    if ($parts[0] -eq '技术') { return '技术' }
    if ($parts[0] -eq '感悟' -and $parts.Length -ge 2) {
        if ($parts[1] -eq '读书') { return '感悟|读书' }
        if ($parts[1] -eq '播客') { return '感悟|播客' }
    }

    return $null
}

$files = @(Get-ChildItem -LiteralPath $Inbox -Recurse -File | Where-Object {
    $_.Extension -in @('.md', '.markdown')
})

if ($files.Count -eq 0) {
    Write-Host '没有找到 Markdown 文件。'
    exit 0
}

foreach ($file in $files) {
    $categorySpec = Get-CategorySpec $file.FullName
    if (-not $categorySpec) {
        throw "文件必须放在 技术、感悟\读书 或 感悟\播客：$($file.FullName)"
    }

    $slug = [IO.Path]::GetFileNameWithoutExtension($file.Name) -replace '\s+', '-'
    Write-Host "同步：$($file.Name) [$categorySpec]"

    if ($DryRun) { continue }

    & $bash $publishScript $file.FullName $slug $categorySpec
    if ($LASTEXITCODE -ne 0) {
        throw "发布失败：$($file.FullName)"
    }
}

Write-Host '全部笔记同步完成。'
