<#
.SYNOPSIS
    Publishes the current RepCoach files to GitHub Pages.

.DESCRIPTION
    Bumps the service-worker VERSION so installed copies pick up the change, runs
    the planner check, then commits and pushes. GitHub Pages redeploys on push,
    usually within a minute.

.PARAMETER Message
    Commit message.

.PARAMETER SkipCheck
    Skip tools/check-planner.mjs (e.g. when Node isn't available).

.PARAMETER NodePath
    node.exe used for the planner check.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File tools\publish.ps1 -Message "Add kettlebell swaps"

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File tools\publish.ps1 -Message "Copy tweaks" -SkipCheck
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)] [string]$Message,
    [switch]$SkipCheck,
    [string]$NodePath = 'C:\Users\X\Documents\REA\node-v24.20.0-win-x64\node.exe'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

$git = (Get-Command git -ErrorAction SilentlyContinue).Source
if (-not $git) { $git = 'C:\Users\X\Documents\Tools\PortableGit\cmd\git.exe' }
if (-not (Test-Path $git)) { throw "git not found. See README / TEARDOWN for where it was installed." }

if (-not $SkipCheck) {
    Write-Verbose 'Running planner check'
    & $NodePath tools/check-planner.mjs | Select-Object -Last 2
    if ($LASTEXITCODE -ne 0) { throw 'Planner check failed; fix it or rerun with -SkipCheck.' }
}

# Installed copies only refresh their cached shell when sw.js itself changes.
$sw = Join-Path $root 'sw.js'
$version = 'v' + (Get-Date -Format 'yyyyMMdd-HHmm')
$text = [IO.File]::ReadAllText($sw)
$updated = [regex]::Replace($text, "const VERSION = '[^']*';", "const VERSION = '$version';")
if ($updated -eq $text) { throw "Couldn't find the VERSION line in sw.js." }
[IO.File]::WriteAllText($sw, $updated, (New-Object System.Text.UTF8Encoding $false))
Write-Host "Service worker version -> $version"

& $git add -A
& $git commit -m $Message
if ($LASTEXITCODE -ne 0) { throw 'git commit failed.' }
& $git push
if ($LASTEXITCODE -ne 0) { throw 'git push failed.' }
Write-Host 'Pushed. GitHub Pages usually redeploys within a minute.'
