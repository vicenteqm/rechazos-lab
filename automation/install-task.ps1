$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$pythonRuntime = Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/pythonw.exe'
if (-not (Test-Path -LiteralPath $pythonRuntime)) { throw 'No se encontró el runtime Python de este equipo.' }
$runner = Join-Path $PSScriptRoot 'scheduled.py'
$action = New-ScheduledTaskAction -Execute $pythonRuntime -Argument ('"' + $runner + '"') -WorkingDirectory $projectRoot
$repeat = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 5)
$logon = New-ScheduledTaskTrigger -AtLogOn -User ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name)
$principal = New-ScheduledTaskPrincipal -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 20) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$task = New-ScheduledTask -Action $action -Trigger @($repeat,$logon) -Principal $principal -Settings $settings -Description 'Lee cinco carpetas INVEX, conserva el histórico mensual y actualiza solo el tablero local.'
Register-ScheduledTask -TaskName 'RechazosLab-ActualizarLocal' -InputObject $task -Force | Select-Object TaskName,State
