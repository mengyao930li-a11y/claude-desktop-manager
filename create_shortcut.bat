@echo off
set "SCRIPT_DIR=%~dp0"

echo Creating Claude Desktop Manager shortcut...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$WshShell = New-Object -comObject WScript.Shell; $DesktopPath = $WshShell.SpecialFolders.Item('Desktop'); $Shortcut = $WshShell.CreateShortcut('$DesktopPath\Claude Desktop Manager.lnk'); $Shortcut.TargetPath = 'wscript.exe'; $Shortcut.Arguments = '\"%SCRIPT_DIR%launch.vbs\"'; $Shortcut.WorkingDirectory = '%SCRIPT_DIR%'; $Shortcut.IconLocation = '%SCRIPT_DIR%node_modules\electron\dist\electron.exe, 0'; $Shortcut.Description = 'Launch Claude Code Desktop Manager'; $Shortcut.Save(); Write-Host '✅ Shortcut created successfully on your Desktop! You may now close this window.' -ForegroundColor Green"

pause
