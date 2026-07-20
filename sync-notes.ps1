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
    $directory = [IO.Path]::GetDirectoryName($relative)
    if ([string]::IsNullOrWhiteSpace($directory)) {
        return $null
    }

    $parts = @($directory -split '[\\/]') | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
    if ($parts.Count -eq 0) {
        return $null
    }

    return ($parts -join '|')
}

$files = @(Get-ChildItem -LiteralPath $Inbox -Recurse -File | Where-Object {
    $_.Extension -in @('.md', '.markdown')
})

if ($files.Count -eq 0) {
    Write-Host '没有找到 Markdown 文件。'
    exit 0
}

$seenSlugs = @{}
$publishArgs = @('--batch')
foreach ($file in $files) {
    $categorySpec = Get-CategorySpec $file.FullName
    if (-not $categorySpec) {
        throw "文件必须放在分类文件夹内，例如 技术\Linux 或 感悟\读书：$($file.FullName)"
    }

    $slug = [IO.Path]::GetFileNameWithoutExtension($file.Name) -replace '\s+', '-'
    if ($seenSlugs.ContainsKey($slug)) {
        throw "发现重复的文章网址名 '$slug'：$($seenSlugs[$slug]) 和 $($file.FullName)"
    }
    $seenSlugs[$slug] = $file.FullName

    Write-Host "同步：$($file.Name) [$categorySpec]"
    $publishArgs += @($file.FullName, $slug, $categorySpec)
}

if ($DryRun) {
    Write-Host "演练完成：共 $($files.Count) 篇笔记。"
    exit 0
}

Write-Host "开始批量发布：共 $($files.Count) 篇笔记。"
& $bash $publishScript @publishArgs
if ($LASTEXITCODE -ne 0) {
    throw '批量发布失败。'
}

Write-Host '全部笔记同步完成。'
