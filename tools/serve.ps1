<#
.SYNOPSIS
    Starts the betterBone dev server.

.DESCRIPTION
    Thin wrapper around tools/serve.js so you don't need Node on PATH. Defaults to
    the portable Node in the REA folder.

.PARAMETER Port
    Port to listen on. Default 8080.

.PARAMETER NodePath
    Path to node.exe.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File tools\serve.ps1

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File tools\serve.ps1 -Port 9000 -NodePath 'C:\tools\node\node.exe'
#>
[CmdletBinding()]
param(
    [int]$Port = 8080,
    [string]$NodePath = 'C:\Users\X\Documents\REA\node-v24.20.0-win-x64\node.exe'
)

$ErrorActionPreference = 'Stop'
if (-not (Test-Path $NodePath)) { throw "node.exe not found at '$NodePath'. Pass -NodePath." }
$script = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) 'serve.js'
& $NodePath $script $Port
