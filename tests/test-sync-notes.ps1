$ErrorActionPreference = 'Stop'

$repo = Split-Path -Parent $PSScriptRoot
$script = Join-Path $repo 'sync-notes.ps1'
$root = Join-Path ([IO.Path]::GetTempPath()) "quchaosheng-sync-$([guid]::NewGuid().ToString('N'))"

New-Item -ItemType Directory -Force -Path @(
    (Join-Path $root '技术'),
    (Join-Path $root '感悟\读书'),
    (Join-Path $root '感悟\播客')
) | Out-Null

try {
    Set-Content -LiteralPath (Join-Path $root '技术\same.md') -Value 'technical' -Encoding UTF8
    Set-Content -LiteralPath (Join-Path $root '感悟\读书\same.md') -Value 'book' -Encoding UTF8

    $oldErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $inboxWithTrailingSlash = "$root\"
    $duplicateOutput = @(& powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File $script -Inbox $inboxWithTrailingSlash -DryRun 2>&1)
    $duplicateExitCode = $LASTEXITCODE
    $ErrorActionPreference = $oldErrorActionPreference
    $duplicateText = $duplicateOutput -join "`n"
    if ($duplicateExitCode -eq 0 -or $duplicateText -notmatch '重复') {
        throw 'duplicate slugs should fail before publishing'
    }

    Remove-Item -LiteralPath (Join-Path $root '感悟\读书\same.md') -Force
    Set-Content -LiteralPath (Join-Path $root '感悟\读书\book.md') -Value 'book' -Encoding UTF8
    Set-Content -LiteralPath (Join-Path $root '感悟\播客\podcast.md') -Value 'podcast' -Encoding UTF8

    $dryRunOutput = @(& powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File $script -Inbox $inboxWithTrailingSlash -DryRun)
    if ($LASTEXITCODE -ne 0) {
        throw 'valid categorized notes should pass dry-run'
    }
    $dryRunText = $dryRunOutput -join "`n"
    $hasTechnical = $dryRunText -match 'same.md \[技术\]'
    $hasBook = $dryRunText -match 'book.md \[感悟\|读书\]'
    $hasPodcast = $dryRunText -match 'podcast.md \[感悟\|播客\]'
    $hasCount = $dryRunText -match '共 3 篇笔记'
    if (-not ($hasTechnical -and $hasBook -and $hasPodcast -and $hasCount)) {
        throw 'dry-run output did not report all categories'
    }

    Write-Output 'sync-notes tests passed'
}
finally {
    if (Test-Path -LiteralPath $root) {
        Remove-Item -LiteralPath $root -Recurse -Force
    }
}
