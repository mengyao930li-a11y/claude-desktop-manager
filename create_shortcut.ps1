$ScriptDir = $PSScriptRoot
if ([string]::IsNullOrEmpty($ScriptDir)) {
    $ScriptDir = (Get-Item .).FullName
}

$WshShell = New-Object -comObject WScript.Shell
$DesktopPath = $WshShell.SpecialFolders.Item("Desktop")
$Shortcut = $WshShell.CreateShortcut("$DesktopPath\Claude Desktop Manager.lnk")

# Uses the invisible VBS launcher
$Shortcut.TargetPath = "wscript.exe"
$Shortcut.Arguments = """$ScriptDir\launch.vbs"""
$Shortcut.WorkingDirectory = "$ScriptDir"
$Shortcut.IconLocation = "$ScriptDir\node_modules\electron\dist\electron.exe, 0"
$Shortcut.Description = "Launch Claude Code Desktop Manager"
$Shortcut.Save()

Write-Host "✅ Shortcut 'Claude Desktop Manager' created successfully on your Desktop." -ForegroundColor Green
Write-Host "You can now safely close this terminal and use the desktop icon." -ForegroundColor Yellow
Start-Sleep -Seconds 3
