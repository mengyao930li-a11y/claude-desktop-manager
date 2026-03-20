const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Window
  minimize:      () => ipcRenderer.invoke('window-minimize'),
  maximize:      () => ipcRenderer.invoke('window-maximize'),
  close:         () => ipcRenderer.invoke('window-close'),
  isMaximized:   () => ipcRenderer.invoke('window-is-maximized'),
  onWindowState: (cb) => ipcRenderer.on('window-state-change', (_, v) => cb(v)),

  // Filesystem
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  openInExplorer:  (p) => ipcRenderer.invoke('open-in-explorer', p),
  openExternal:    (u) => ipcRenderer.invoke('open-external', u),

  // Config
  getConfig:  () => ipcRenderer.invoke('get-config'),
  saveConfig: (c) => ipcRenderer.invoke('save-config', c),

  // Workspaces
  createWorkspace: (o) => ipcRenderer.invoke('create-workspace', o),
  listWorkspaces:  () => ipcRenderer.invoke('list-workspaces'),
  deleteWorkspace: (o) => ipcRenderer.invoke('delete-workspace', o),
  updateWorkspace: (o) => ipcRenderer.invoke('update-workspace', o),
  importWorkspace: (p) => ipcRenderer.invoke('import-workspace', p),

  // Terminal (node-pty backed)
  createTerminal:  (o) => ipcRenderer.invoke('create-terminal', o),
  terminalInput:   (o) => ipcRenderer.invoke('terminal-input', o),
  terminalResize:  (o) => ipcRenderer.invoke('terminal-resize', o),
  terminalKill:    (o) => ipcRenderer.invoke('terminal-kill', o),
  onTerminalData:  (cb) => ipcRenderer.on('terminal-data', (_, d) => cb(d)),
  onTerminalExit:  (cb) => ipcRenderer.on('terminal-exit', (_, d) => cb(d)),

  // Claude
  checkClaude:       () => ipcRenderer.invoke('check-claude'),
  checkClaudeUpdate: () => ipcRenderer.invoke('check-claude-update'),

  // Sessions
  recordSession: (o) => ipcRenderer.invoke('record-session', o),
  endSession:    (o) => ipcRenderer.invoke('end-session', o),

  // Skills
  getSkillsPath:    () => ipcRenderer.invoke('get-skills-path'),
  listSkills:       () => ipcRenderer.invoke('list-skills'),
  getSkillDetail:   (n) => ipcRenderer.invoke('get-skill-detail', n),
  installSkillGit:  (u) => ipcRenderer.invoke('install-skill-git', u),
  installSkillLocal:(p) => ipcRenderer.invoke('install-skill-local', p),
  deleteSkill:      (n) => ipcRenderer.invoke('delete-skill', n),
  openSkillsFolder: () => ipcRenderer.invoke('open-skills-folder'),
});
