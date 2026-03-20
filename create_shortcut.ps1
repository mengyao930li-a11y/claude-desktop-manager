$WshShell = New-Object -comObject WScript.Shell
$DesktopPath = $WshShell.SpecialFolders.Item("Desktop")
$Shortcut = $WshShell.CreateShortcut("$DesktopPath\Claude Desktop Manager.lnk")

# Uses the invisible VBS launcher
$Shortcut.TargetPath = "wscript.exe"
$Shortcut.Arguments = """$(Get-Location)\launch.vbs"""
$Shortcut.WorkingDirectory = "$(Get-Location)"
$Shortcut.IconLocation = "$(Get-Location)\node_modules\electron\dist\electron.exe, 0"
$Shortcut.Description = "Launch Claude Code Desktop Manager"
$Shortcut.Save()

Write-Host "✅ Shortcut 'Claude Desktop Manager' created successfully on your Desktop." -ForegroundColor Green
Write-Host "You can now safely close this terminal and use the desktop icon." -ForegroundColor Yellow
Start-Sleep -Seconds 3
