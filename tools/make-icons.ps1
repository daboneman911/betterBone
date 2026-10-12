<#
.SYNOPSIS
    Renders the RepCoach app icons (PNG) with System.Drawing.

.DESCRIPTION
    iOS ignores SVG for home-screen icons and needs a 180x180 apple-touch-icon,
    and the web manifest wants 192/512 plus a maskable variant with extra safe
    padding. Drawing them here keeps the repo free of an image editor dependency.

.PARAMETER OutDir
    Folder to write the icons to. Defaults to ..\icons relative to this script.

.PARAMETER Accent
    Background colour as hex.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File tools\make-icons.ps1

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File tools\make-icons.ps1 -Accent '#2f6fdb'
#>
[CmdletBinding()]
param(
    [string]$OutDir,
    [string]$Accent = '#d0432a'
)

$ErrorActionPreference = 'Stop'
# $PSScriptRoot isn't populated yet when 5.1 evaluates param defaults under -File.
if (-not $OutDir) { $OutDir = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) '..\icons' }
Add-Type -AssemblyName System.Drawing

function New-Icon {
    param([int]$Size, [string]$Path, [double]$Inset)

    $bmp = New-Object System.Drawing.Bitmap $Size, $Size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    try {
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $g.Clear([System.Drawing.ColorTranslator]::FromHtml($Accent))

        # Dumbbell glyph, drawn on a 100-unit grid and scaled. $Inset shrinks it
        # for the maskable icon, whose outer ~20% may be cropped to a circle.
        $scale = $Size / 100.0 * (1 - 2 * $Inset)
        $off = $Size * $Inset
        $white = [System.Drawing.Brushes]::White
        $rect = {
            param($x, $y, $w, $h)
            $g.FillRectangle($white, [single]($off + $x * $scale), [single]($off + $y * $scale), [single]($w * $scale), [single]($h * $scale))
        }
        & $rect 22 44 56 12   # bar
        & $rect 14 30 10 40   # inner plates
        & $rect 76 30 10 40
        & $rect 6 38 8 24     # outer plates
        & $rect 86 38 8 24

        $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
        Write-Verbose "Wrote $Path"
    }
    finally {
        $g.Dispose()
        $bmp.Dispose()
    }
}

New-Item -ItemType Directory -Force $OutDir | Out-Null
$OutDir = (Resolve-Path $OutDir).Path
New-Icon -Size 180 -Path (Join-Path $OutDir 'apple-touch-icon.png') -Inset 0.12
New-Icon -Size 192 -Path (Join-Path $OutDir 'icon-192.png') -Inset 0.12
New-Icon -Size 512 -Path (Join-Path $OutDir 'icon-512.png') -Inset 0.12
New-Icon -Size 512 -Path (Join-Path $OutDir 'icon-maskable-512.png') -Inset 0.22
Get-ChildItem $OutDir -Filter *.png | Select-Object Name, Length
