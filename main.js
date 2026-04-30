const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = require('fs').promises;
const os = require('os');
const pty = require('node-pty');

// Load .env file
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
      process.env[key.trim()] = value.trim();
    }
  });
}

let mainWindow = null;
const terminals = new Map();
let configPath;
let config;

// ─── Config ───────────────────────────────────────────────────────────────────

function loadConfig() {
  configPath = path.join(app.getPath('userData'), 'manager-config.json');
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch {
    config = {
      workspaces: [],
      defaultBasePath: path.join(os.homedir(), 'claude-workspaces'),
      claudePath: 'claude',
      terminal: {
        fontSize: 14,
        fontFamily: 'Cascadia Code, Cascadia Mono, Consolas, Courier New, monospace',
      },
    };
    saveConfig();
  }
}

function saveConfig() {
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

// ─── Window ───────────────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    frame: false,
    backgroundColor: '#0b0d11',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window-state-change', true);
  });
  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window-state-change', false);
  });
}

app.whenReady().then(() => {
  loadConfig();
  migrateEnvToProfiles();
  autoFixProfileUrls();
  syncProfileToClaudeSettings();
  createWindow();
});

function migrateEnvToProfiles() {
  if (config.modelProfiles !== undefined) return;
  config.modelProfiles = [];
  config.activeProfileId = null;

  if (process.env.ANTHROPIC_BASE_URL || process.env.ANTHROPIC_AUTH_TOKEN) {
    const profile = {
      id: `profile-${Date.now()}`,
      name: 'Default (migrated)',
      provider: 'custom',
      baseUrl: process.env.ANTHROPIC_BASE_URL || '',
      apiKey: process.env.ANTHROPIC_AUTH_TOKEN || '',
      model: process.env.ANTHROPIC_MODEL || '',
      opusModel: process.env.ANTHROPIC_DEFAULT_OPUS_MODEL || '',
      sonnetModel: process.env.ANTHROPIC_DEFAULT_SONNET_MODEL || '',
      haikuModel: process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL || '',
      subagentModel: process.env.CLAUDE_CODE_SUBAGENT_MODEL || '',
    };
    config.modelProfiles.push(profile);
    config.activeProfileId = profile.id;
  }
  saveConfig();
}

app.on('window-all-closed', () => {
  for (const [, term] of terminals) {
    try { term.kill(); } catch {}
  }
  app.quit();
});

// ─── Window Controls ──────────────────────────────────────────────────────────

ipcMain.handle('window-minimize', () => mainWindow?.minimize());
ipcMain.handle('window-maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.handle('window-close', () => mainWindow?.close());
ipcMain.handle('window-is-maximized', () => mainWindow?.isMaximized() ?? false);

// ─── File System ──────────────────────────────────────────────────────────────

ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('open-in-explorer', async (_, dirPath) => {
  shell.openPath(dirPath);
});

ipcMain.handle('open-external', async (_, url) => {
  shell.openExternal(url);
});

// ─── Config API ───────────────────────────────────────────────────────────────

ipcMain.handle('get-config', () => config);

ipcMain.handle('save-config', (_, partial) => {
  config = { ...config, ...partial };
  saveConfig();

  if (partial.modelProfiles !== undefined || partial.activeProfileId !== undefined) {
    autoFixProfileUrls();
    syncProfileToClaudeSettings();
  }

  return config;
});

const PROVIDER_CANONICAL_URLS = {
  anthropic:   'https://api.anthropic.com',
  kimi:        'https://api.moonshot.cn/anthropic',
  zhipu:       'https://open.bigmodel.cn/api/anthropic',
  deepseek:    'https://api.deepseek.com/anthropic',
  qwen:        'https://dashscope.aliyuncs.com/apps/anthropic',
  openrouter:  'https://openrouter.ai/api',
  siliconflow: 'https://api.siliconflow.cn/',
  gemini:      'https://generativelanguage.googleapis.com/v1beta',
  minimax:     'https://api.minimaxi.com/anthropic',
};

function autoFixProfileUrls() {
  const profiles = config.modelProfiles || [];
  let changed = false;
  for (const p of profiles) {
    const canonical = PROVIDER_CANONICAL_URLS[p.provider];
    if (canonical && p.baseUrl && p.baseUrl !== canonical) {
      console.log(`[profile-fix] ${p.name}: baseUrl ${p.baseUrl} → ${canonical}`);
      p.baseUrl = canonical;
      changed = true;
    }
  }
  if (changed) saveConfig();
}

function syncProfileToClaudeSettings() {
  const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
  try {
    let settings = {};
    try {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    } catch {}

    if (!settings.env) settings.env = {};

    const keysToManage = [
      'ANTHROPIC_BASE_URL', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_API_KEY',
      'ANTHROPIC_MODEL', 'ANTHROPIC_DEFAULT_OPUS_MODEL',
      'ANTHROPIC_DEFAULT_SONNET_MODEL', 'ANTHROPIC_DEFAULT_HAIKU_MODEL',
      'CLAUDE_CODE_SUBAGENT_MODEL', 'API_TIMEOUT_MS',
      'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC',
    ];
    for (const key of keysToManage) {
      delete settings.env[key];
    }

    const profile = (config.modelProfiles || []).find(p => p.id === config.activeProfileId);

    if (profile) {
      if (profile.baseUrl)       settings.env.ANTHROPIC_BASE_URL = profile.baseUrl;
      if (profile.apiKey) {
        if (profile.provider === 'openrouter') {
          settings.env.ANTHROPIC_API_KEY = '';
          settings.env.ANTHROPIC_AUTH_TOKEN = profile.apiKey;
        } else {
          settings.env.ANTHROPIC_AUTH_TOKEN = profile.apiKey;
          settings.env.ANTHROPIC_API_KEY = profile.apiKey;
        }
      }
      if (profile.model)         settings.env.ANTHROPIC_MODEL = profile.model;
      if (profile.opusModel)     settings.env.ANTHROPIC_DEFAULT_OPUS_MODEL = profile.opusModel;
      if (profile.sonnetModel)   settings.env.ANTHROPIC_DEFAULT_SONNET_MODEL = profile.sonnetModel;
      if (profile.haikuModel)    settings.env.ANTHROPIC_DEFAULT_HAIKU_MODEL = profile.haikuModel;
      if (profile.subagentModel) settings.env.CLAUDE_CODE_SUBAGENT_MODEL = profile.subagentModel;

      if (profile.customEnv) {
        for (const line of profile.customEnv.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx > 0) {
            settings.env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
          }
        }
      }
    }

    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to sync profile to settings.json:', err);
  }
}

// ─── Workspace Management ─────────────────────────────────────────────────────

ipcMain.handle('create-workspace', async (_, opts) => {
  const { name, type, basePath, description, constraints } = opts;
  const safeName = name.replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]/g, '-').toLowerCase();
  const workspacePath = path.join(basePath || config.defaultBasePath, safeName);

  const dirs = [
    '.claude/skills',
    'context/research',
    'context/references',
    'sessions/archive',
    'output',
  ];

  for (const dir of dirs) {
    await fsp.mkdir(path.join(workspacePath, dir), { recursive: true });
  }

  const claudeMd = buildClaudeMd({ name, type, description, constraints, workspacePath });
  await fsp.writeFile(path.join(workspacePath, '.claude', 'CLAUDE.md'), claudeMd, 'utf-8');

  const reqMd = `# ${name}\n\n## Requirements\n\n${description || 'TODO: Define requirements'}\n\n## Notes\n\n`;
  await fsp.writeFile(path.join(workspacePath, 'context', 'requirements.md'), reqMd, 'utf-8');

  const workspace = {
    id: Date.now().toString(),
    name,
    type,
    description: description || '',
    path: workspacePath,
    createdAt: new Date().toISOString(),
    lastAccessedAt: new Date().toISOString(),
    sessions: [],
  };

  config.workspaces.push(workspace);
  saveConfig();
  return workspace;
});

ipcMain.handle('list-workspaces', async () => {
  const valid = [];
  for (const ws of config.workspaces) {
    try {
      await fsp.access(ws.path);
      valid.push(ws);
    } catch {
      // directory removed externally, skip
    }
  }
  config.workspaces = valid;
  saveConfig();
  return valid;
});

ipcMain.handle('delete-workspace', async (_, { id, deleteFiles }) => {
  const ws = config.workspaces.find(w => w.id === id);
  if (ws && deleteFiles) {
    await fsp.rm(ws.path, { recursive: true, force: true });
  }
  config.workspaces = config.workspaces.filter(w => w.id !== id);
  saveConfig();
  return true;
});

ipcMain.handle('update-workspace', async (_, { id, updates }) => {
  const idx = config.workspaces.findIndex(w => w.id === id);
  if (idx !== -1) {
    config.workspaces[idx] = {
      ...config.workspaces[idx],
      ...updates,
      lastAccessedAt: new Date().toISOString(),
    };
    saveConfig();
    return config.workspaces[idx];
  }
  return null;
});

ipcMain.handle('import-workspace', async (_, dirPath) => {
  const existing = config.workspaces.find(w => w.path === dirPath);
  if (existing) return existing;

  const name = path.basename(dirPath);
  const workspace = {
    id: Date.now().toString(),
    name,
    type: 'imported',
    description: `Imported from ${dirPath}`,
    path: dirPath,
    createdAt: new Date().toISOString(),
    lastAccessedAt: new Date().toISOString(),
    sessions: [],
  };
  config.workspaces.push(workspace);
  saveConfig();
  return workspace;
});

// ─── Terminal Management (node-pty) ───────────────────────────────────────────

ipcMain.handle('create-terminal', async (_, opts) => {
  const { id, cwd, launchClaude, claudeArgs, profileId } = opts;

  const shellName = os.platform() === 'win32'
    ? 'powershell.exe'
    : (process.env.SHELL || '/bin/bash');

  const profile = (config.modelProfiles || []).find(
    p => p.id === (profileId || config.activeProfileId)
  );

  const env = { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' };

  const MODEL_ENV_KEYS = [
    'ANTHROPIC_BASE_URL', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_API_KEY',
    'ANTHROPIC_MODEL', 'ANTHROPIC_DEFAULT_OPUS_MODEL',
    'ANTHROPIC_DEFAULT_SONNET_MODEL', 'ANTHROPIC_DEFAULT_HAIKU_MODEL',
    'CLAUDE_CODE_SUBAGENT_MODEL', 'API_TIMEOUT_MS',
    'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC',
  ];
  for (const key of MODEL_ENV_KEYS) {
    delete env[key];
  }

  if (profile) {
    if (profile.baseUrl)       env.ANTHROPIC_BASE_URL = profile.baseUrl;
    if (profile.apiKey) {
      if (profile.provider === 'openrouter') {
        env.ANTHROPIC_API_KEY = '';
        env.ANTHROPIC_AUTH_TOKEN = profile.apiKey;
      } else {
        env.ANTHROPIC_AUTH_TOKEN = profile.apiKey;
        env.ANTHROPIC_API_KEY = profile.apiKey;
      }
    }
    if (profile.model)         env.ANTHROPIC_MODEL = profile.model;
    if (profile.opusModel)     env.ANTHROPIC_DEFAULT_OPUS_MODEL = profile.opusModel;
    if (profile.sonnetModel)   env.ANTHROPIC_DEFAULT_SONNET_MODEL = profile.sonnetModel;
    if (profile.haikuModel)    env.ANTHROPIC_DEFAULT_HAIKU_MODEL = profile.haikuModel;
    if (profile.subagentModel) env.CLAUDE_CODE_SUBAGENT_MODEL = profile.subagentModel;

    if (profile.customEnv) {
      for (const line of profile.customEnv.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
          env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
        }
      }
    }
  }

  const ptyProcess = pty.spawn(shellName, [], {
    name: 'xterm-256color',
    cols: 120,
    rows: 30,
    cwd: cwd || os.homedir(),
    env,
  });

  terminals.set(id, ptyProcess);

  ptyProcess.onData((data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('terminal-data', { id, data });
    }
  });

  ptyProcess.onExit(({ exitCode, signal }) => {
    terminals.delete(id);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('terminal-exit', { id, exitCode, signal });
    }
  });

  if (launchClaude) {
    const cmd = claudeArgs ? `claude ${claudeArgs}` : 'claude';
    setTimeout(() => ptyProcess.write(cmd + '\r'), 600);
  } else if (opts.customCommand) {
    setTimeout(() => ptyProcess.write(opts.customCommand + '\r'), 600);
  }

  return { id, pid: ptyProcess.pid };
});

ipcMain.handle('terminal-input', (_, { id, data }) => {
  const term = terminals.get(id);
  if (term) term.write(data);
});

ipcMain.handle('terminal-resize', (_, { id, cols, rows }) => {
  const term = terminals.get(id);
  if (term) {
    try { term.resize(Math.max(cols, 2), Math.max(rows, 2)); } catch {}
  }
});

ipcMain.handle('terminal-kill', (_, { id }) => {
  const term = terminals.get(id);
  if (term) {
    try { term.kill(); } catch {}
    terminals.delete(id);
  }
});

// ─── Claude Detection ─────────────────────────────────────────────────────────

ipcMain.handle('check-claude', () => {
  return new Promise((resolve) => {
    const { exec } = require('child_process');
    exec('claude --version', { timeout: 5000 }, (error, stdout) => {
      resolve(error
        ? { installed: false, version: null }
        : { installed: true, version: stdout.trim() });
    });
  });
});

ipcMain.handle('check-claude-update', () => {
  return new Promise((resolve) => {
    const { exec } = require('child_process');
    exec('npm show @anthropic-ai/claude-code version', { timeout: 5000 }, (error, stdout) => {
      resolve(error ? null : stdout.trim());
    });
  });
});

// ─── Session Context (Last Session Memory) ────────────────────────────────────

function workspacePathToClaudeDir(wsPath) {
  return wsPath.replace(/[:\\/]/g, '-');
}

ipcMain.handle('get-session-context', async (_, wsPath) => {
  try {
    const dirName = workspacePathToClaudeDir(wsPath);
    const projectDir = path.join(os.homedir(), '.claude', 'projects', dirName);

    let stat;
    try { stat = await fsp.stat(projectDir); } catch { return null; }
    if (!stat.isDirectory()) return null;

    const files = (await fsp.readdir(projectDir))
      .filter(f => f.endsWith('.jsonl'));
    if (files.length === 0) return null;

    const fileMeta = await Promise.all(files.map(async (f) => {
      const s = await fsp.stat(path.join(projectDir, f));
      return { name: f, mtime: s.mtimeMs };
    }));
    fileMeta.sort((a, b) => b.mtime - a.mtime);

    const latest = fileMeta[0];
    const content = await fsp.readFile(path.join(projectDir, latest.name), 'utf-8');
    const lines = content.split('\n').filter(Boolean);

    const userMessages = [];
    const assistantSnippets = [];

    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        if (obj.type === 'user' && obj.message?.content) {
          let text = '';
          if (typeof obj.message.content === 'string') {
            text = obj.message.content;
          } else if (Array.isArray(obj.message.content)) {
            const part = obj.message.content.find(p => p.type === 'text');
            if (part) text = part.text;
          }
          text = text.replace(/<[^>]+>/g, '').trim();
          if (text && text.length > 2 && !text.startsWith('#') && !text.startsWith('<command')) {
            userMessages.push(text.slice(0, 200));
          }
        }
        if (obj.type === 'assistant' && obj.message?.content) {
          let text = '';
          if (typeof obj.message.content === 'string') {
            text = obj.message.content;
          } else if (Array.isArray(obj.message.content)) {
            const part = obj.message.content.find(p => p.type === 'text');
            if (part) text = part.text;
          }
          text = text.replace(/<[^>]+>/g, '').trim();
          if (text && text.length > 10) {
            assistantSnippets.push(text.slice(0, 300));
          }
        }
      } catch {}
    }

    const sessionDate = new Date(latest.mtime).toLocaleString();
    const sessionId = latest.name.replace('.jsonl', '');

    return {
      sessionId,
      sessionDate,
      totalSessions: files.length,
      userMessages: userMessages.slice(0, 5),
      lastAssistantSnippet: assistantSnippets.length > 0
        ? assistantSnippets[assistantSnippets.length - 1]
        : null,
    };
  } catch (err) {
    console.error('Failed to get session context:', err);
    return null;
  }
});

// ─── Session Tracking ─────────────────────────────────────────────────────────

ipcMain.handle('record-session', async (_, { workspaceId, terminalId }) => {
  const ws = config.workspaces.find(w => w.id === workspaceId);
  if (!ws) return null;

  const now = new Date();
  const sessionId = `${now.toISOString().slice(0, 10)}-${String((ws.sessions?.length || 0) + 1).padStart(3, '0')}`;
  const sessionDir = path.join(ws.path, 'sessions', sessionId);
  await fsp.mkdir(sessionDir, { recursive: true });

  const session = {
    id: sessionId,
    terminalId,
    startedAt: now.toISOString(),
    endedAt: null,
  };

  if (!ws.sessions) ws.sessions = [];
  ws.sessions.push(session);
  ws.lastAccessedAt = now.toISOString();
  saveConfig();
  return session;
});

ipcMain.handle('end-session', async (_, { workspaceId, sessionId }) => {
  const ws = config.workspaces.find(w => w.id === workspaceId);
  if (!ws) return;
  const s = ws.sessions?.find(s => s.id === sessionId);
  if (s) {
    s.endedAt = new Date().toISOString();
    saveConfig();
  }
});

// ─── Skills Management ────────────────────────────────────────────────────────

function getGlobalSkillsPath() {
  return path.join(os.homedir(), '.claude', 'skills');
}

ipcMain.handle('get-skills-path', () => getGlobalSkillsPath());

ipcMain.handle('list-skills', async () => {
  const skillsDir = getGlobalSkillsPath();
  try {
    await fsp.mkdir(skillsDir, { recursive: true });
    const entries = await fsp.readdir(skillsDir, { withFileTypes: true });
    const skills = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillPath = path.join(skillsDir, entry.name);
      const skillMd = path.join(skillPath, 'SKILL.md');
      let description = '';
      let hasSkillMd = false;

      try {
        const content = await fsp.readFile(skillMd, 'utf-8');
        hasSkillMd = true;
        const firstParagraph = content.split('\n').filter(l => l.trim() && !l.startsWith('#'))[0];
        description = firstParagraph ? firstParagraph.trim().slice(0, 200) : '';
      } catch {}

      const subSkills = await findSubSkills(skillPath);

      skills.push({
        name: entry.name,
        path: skillPath,
        hasSkillMd,
        description,
        subSkills,
      });
    }

    return skills;
  } catch {
    return [];
  }
});

async function findSubSkills(dir) {
  const results = [];
  try {
    const items = await fsp.readdir(dir, { withFileTypes: true });
    for (const item of items) {
      if (!item.isDirectory()) continue;
      const subDir = path.join(dir, item.name);
      const subSkillMd = path.join(subDir, 'SKILL.md');
      try {
        await fsp.access(subSkillMd);
        results.push(item.name);
      } catch {}
      const deeper = await findSubSkills(subDir);
      results.push(...deeper.map(d => `${item.name}/${d}`));
    }
  } catch {}
  return results;
}

async function findSkillDirectories(dir, maxDepth = 3, currentDepth = 0) {
  if (currentDepth > maxDepth) return [];
  const results = [];
  try {
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      const subDir = path.join(dir, entry.name);
      try {
        await fsp.access(path.join(subDir, 'SKILL.md'));
        results.push(subDir);
      } catch {
        const deeper = await findSkillDirectories(subDir, maxDepth, currentDepth + 1);
        results.push(...deeper);
      }
    }
  } catch {}
  return results;
}

async function copyDir(src, dest, ignoreList = []) {
  if (ignoreList.length === 0) {
    await fsp.cp(src, dest, { recursive: true, force: true });
    return;
  }
  await fsp.mkdir(dest, { recursive: true });
  const entries = await fsp.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    if (ignoreList.includes(entry.name)) continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath, ignoreList);
    } else {
      await fsp.copyFile(srcPath, destPath);
    }
  }
}

ipcMain.handle('get-skill-detail', async (_, skillName) => {
  const skillMd = path.join(getGlobalSkillsPath(), skillName, 'SKILL.md');
  try {
    const content = await fsp.readFile(skillMd, 'utf-8');
    return { ok: true, content };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('install-skill-git', async (_, gitUrl) => {
  const { exec } = require('child_process');
  const tmpDir = path.join(os.tmpdir(), `skill-clone-${Date.now()}`);

  return new Promise((resolve) => {
    exec(`git clone --depth 1 "${gitUrl}" "${tmpDir}"`, { timeout: 60000 }, async (error) => {
      if (error) {
        resolve({ ok: false, error: `Git clone failed: ${error.message}` });
        return;
      }

      try {
        const skillsDir = getGlobalSkillsPath();
        await fsp.mkdir(skillsDir, { recursive: true });

        const rootSkillMd = path.join(tmpDir, 'SKILL.md');
        let installed = [];

        try {
          await fsp.access(rootSkillMd);
          const repoName = path.basename(gitUrl, '.git').replace(/[^a-zA-Z0-9_-]/g, '-');
          const dest = path.join(skillsDir, repoName);
          await copyDir(tmpDir, dest, ['.git']);
          installed.push(repoName);
        } catch {
          const foundSkillDirs = await findSkillDirectories(tmpDir, 3);
          for (const dir of foundSkillDirs) {
            const skillName = path.basename(dir);
            const dest = path.join(skillsDir, skillName);
            await copyDir(dir, dest, ['.git']);
            if (!installed.includes(skillName)) installed.push(skillName);
          }
        }

        await fsp.rm(tmpDir, { recursive: true, force: true }).catch(() => {});

        if (installed.length === 0) {
          resolve({ ok: false, error: 'No SKILL.md found in the repository (checked root and subdirectories).' });
        } else {
          resolve({ ok: true, installed });
        }
      } catch (err) {
        await fsp.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
        resolve({ ok: false, error: err.message });
      }
    });
  });
});

ipcMain.handle('install-skill-local', async (_, srcPath) => {
  try {
    const skillsDir = getGlobalSkillsPath();
    await fsp.mkdir(skillsDir, { recursive: true });

    const skillMd = path.join(srcPath, 'SKILL.md');
    try {
      await fsp.access(skillMd);
    } catch {
      return { ok: false, error: 'Selected directory does not contain a SKILL.md file.' };
    }

    const name = path.basename(srcPath);
    const dest = path.join(skillsDir, name);
    await copyDir(srcPath, dest, ['.git', 'node_modules']);

    return { ok: true, installed: [name] };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('delete-skill', async (_, skillName) => {
  const skillPath = path.join(getGlobalSkillsPath(), skillName);
  try {
    await fsp.rm(skillPath, { recursive: true, force: true });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('open-skills-folder', async () => {
  const skillsDir = getGlobalSkillsPath();
  await fsp.mkdir(skillsDir, { recursive: true });
  shell.openPath(skillsDir);
});

async function copyDir(src, dest, excludes = []) {
  await fsp.mkdir(dest, { recursive: true });
  const entries = await fsp.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    if (excludes.includes(entry.name)) continue;
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(s, d, excludes);
    } else {
      await fsp.copyFile(s, d);
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildClaudeMd({ name, type, description, constraints, workspacePath }) {
  const presets = {
    research: '- Follow academic writing standards\n- Cite sources with proper format\n- Maintain logical coherence\n- Use statistical rigor',
    development: '- Follow project style guide\n- Write tests first (TDD)\n- Keep functions focused and small\n- Document public APIs',
    writing: '- Natural, non-AI writing style\n- Consistent tone throughout\n- Clear structure and transitions',
    analysis: '- Statistical rigor required\n- Reproducible results\n- Clear visualizations with labels',
    general: '- Keep code clean and documented\n- Follow best practices',
  };

  return `# ${name}

## Type
${type}

## Description
${description || 'No description.'}

## Working Directory
${workspacePath}

## Constraints
${constraints || presets[type] || presets.general}

## Context
- context/requirements.md
- context/research/
- context/references/
`;
}
