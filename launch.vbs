Set fso = CreateObject("Scripting.FileSystemObject")
currentDir = fso.GetParentFolderName(WScript.ScriptFullName)

Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = currentDir

' Build renderer if dist doesn't exist
If Not fso.FileExists(currentDir & "\dist\renderer.js") Then
    WshShell.Run "cmd /c node scripts/build.js", 0, True
End If

' Launch Electron app (hidden console)
WshShell.Run """" & currentDir & "\node_modules\electron\dist\electron.exe"" .", 1, False
