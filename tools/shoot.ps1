# shoot.ps1 – tar skärmdumpar av granskningsarket och spelet med headless Edge.
# Körs från valfri mapp: powershell -ExecutionPolicy Bypass -File spel\tools\shoot.ps1
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$out = Join-Path $here 'review'
New-Item -ItemType Directory -Force $out | Out-Null

$edge = @(
  "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
  "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) { throw "Hittar inte msedge.exe" }

function Shoot($htmlPath, $pngName, $w, $h, $budget, $query) {
  $uri = ([System.Uri](Resolve-Path $htmlPath).Path).AbsoluteUri + $query
  $png = Join-Path $out $pngName
  if (Test-Path $png) { Remove-Item $png -Force }
  # Egen profilmapp så att en redan öppen Edge inte stör (annars exit 13)
  $udir = Join-Path $env:TEMP 'edvin_hedda_edgeprofile'
  New-Item -ItemType Directory -Force $udir | Out-Null
  $edgeArgs = @(
    '--headless=new', '--disable-gpu', '--no-first-run',
    "--user-data-dir=`"$udir`"",
    '--allow-file-access-from-files',
    "--virtual-time-budget=$budget",
    "--window-size=$w,$h",
    "--screenshot=`"$png`"",
    "`"$uri`""
  )
  $p = Start-Process -FilePath $edge -ArgumentList $edgeArgs -PassThru -Wait -NoNewWindow
  if (Test-Path $png) { Write-Output "OK  $png" } else { Write-Output "MISSLYCKADES  $pngName (exit $($p.ExitCode))" }
}

$only = $args[0]
if (-not $only -or $only -eq 'solve') { Shoot (Join-Path $here 'solve.html') 'losningsbot.png' 1000 2800 8000 }
if (-not $only -or $only -eq 'preview') { Shoot (Join-Path $here 'preview.html') 'granskningsark.png' 1600 5200 5000 }
if (-not $only -or $only -eq 'title') { Shoot (Join-Path $here '..\index.html') 'titelskarm.png' 1888 870 2500 '' }
if (-not $only -or $only -eq 'wardrobe') { Shoot (Join-Path $here '..\index.html') 'garderob.png' 1344 768 2500 '?garderob' }
