Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "c:\Users\admin\claude-desktop-manager"

' Build renderer if dist doesn't exist
Set fso = CreateObject("Scripting.FileSystemObject")
If Not fso.FileExists("c:\Users\admin\claude-desktop-manager\dist\renderer.js") Then
    WshShell.Run "cmd /c node scripts/build.js", 0, True
End If

' Launch Electron app (hidden console)
WshShell.Run """c:\Users\admin\claude-desktop-manager\node_modules\electron\dist\electron.exe"" .", 1, False
