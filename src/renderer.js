import { Terminal } from '@xterm/xterm';
import { FitAddon }  from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';

// ─── State ────────────────────────────────────────────────────────────────────

const state = {
  workspaces: [],
  config: null,
  terminals: new Map(),   // id -> { xterm, fitAddon, container, tabEl, workspaceId, title }
  activeTerminalId: null,
  activeView: 'dashboard',
  deleteTarget: null,
};

// ─── DOM refs ─────────────────────────────────────────────────────────────────

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const dom = {
  views:            { dashboard: $('#view-dashboard'), terminals: $('#view-terminals'), skills: $('#view-skills'), settings: $('#view-settings') },
  navBtns:          $$('.nav-btn'),
  workspaceGrid:    $('#workspace-grid'),
  workspaceCount:   $('#workspace-count'),
  emptyState:       $('#empty-state'),
  terminalTabs:     $('#terminal-tabs'),
  terminalArea:     $('#terminal-area'),
  terminalEmpty:    $('#terminal-empty'),
  terminalCountBadge: $('#terminal-count'),

  skillsList:       $('#skills-list'),
  skillsSubtitle:   $('#skills-subtitle'),
  skillsEmpty:      $('#skills-empty'),
  skillCountBadge:  $('#skill-count'),

  modalNewWs:       $('#modal-new-workspace'),
  modalDelete:      $('#modal-confirm-delete'),
  deleteWsName:     $('#delete-ws-name'),

  modalGitInstall:  $('#modal-git-install'),
  modalSkillDetail: $('#modal-skill-detail'),
  modalDeleteSkill: $('#modal-confirm-delete-skill'),

  modalSessionContext: $('#modal-session-context'),

  modalProfileEditor: $('#modal-profile-editor'),
  modalDeleteProfile: $('#modal-confirm-delete-profile'),
  profileGrid:        $('#profile-grid'),
  profileEmpty:       $('#profile-empty'),
  sidebarProfileSelect: $('#sidebar-profile-select'),

  claudeStatus:     $('#claude-status'),
  updateContainer:  $('#claude-update-container'),
  btnUpdate:        $('#btn-update-claude'),
};

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  state.config = await window.api.getConfig();
  await refreshWorkspaces();
  await refreshSkills();
  await checkClaudeStatus();
  bindEvents();
  bindTerminalIPC();
  loadSettings();
  renderProfiles();
  renderSidebarProfileSelect();
}

document.addEventListener('DOMContentLoaded', init);

// ─── Navigation ───────────────────────────────────────────────────────────────

function switchView(viewName) {
  state.activeView = viewName;
  dom.navBtns.forEach(b => b.classList.toggle('active', b.dataset.view === viewName));
  Object.entries(dom.views).forEach(([k, el]) => el.classList.toggle('active', k === viewName));

  if (viewName === 'terminals') fitActiveTerminal();
}

// ─── Workspace rendering ──────────────────────────────────────────────────────

async function refreshWorkspaces() {
  state.workspaces = await window.api.listWorkspaces();
  renderWorkspaces();
}

function renderWorkspaces() {
  const ws = state.workspaces;
  dom.workspaceCount.textContent = `${ws.length} workspace${ws.length !== 1 ? 's' : ''}`;
  dom.emptyState.style.display = ws.length === 0 ? 'flex' : 'none';
  dom.workspaceGrid.style.display = ws.length === 0 ? 'none' : 'grid';

  dom.workspaceGrid.innerHTML = ws
    .sort((a, b) => new Date(b.lastAccessedAt) - new Date(a.lastAccessedAt))
    .map(w => cardHTML(w))
    .join('');

  dom.workspaceGrid.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleCardAction(btn.dataset.action, btn.dataset.id);
    });
  });
}

function cardHTML(w) {
  const ago = timeAgo(w.lastAccessedAt);
  const sessions = (w.sessions || []).length;
  return `
    <div class="workspace-card">
      <div class="card-top">
        <div class="card-info">
          <h3>${esc(w.name)}</h3>
          <div class="card-path" title="${esc(w.path)}">${esc(w.path)}</div>
        </div>
        <span class="type-badge ${w.type}">${esc(w.type)}</span>
      </div>
      ${w.description ? `<div class="card-description">${esc(w.description)}</div>` : ''}
      <div class="card-meta">
        <span>Last: ${ago}</span>
        <span>${sessions} session${sessions !== 1 ? 's' : ''}</span>
      </div>
      <div class="card-actions">
        <button class="btn btn-sm card-btn-launch" data-action="launch" data-id="${w.id}" title="Start new session">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          Claude Code
        </button>
        ${sessions > 0 ? `
        <button class="btn btn-sm btn-secondary" data-action="resume" data-id="${w.id}" title="Resume last session" style="padding: 0 8px;">
          Resume
        </button>
        ` : ''}
        <button class="btn btn-sm btn-secondary" data-action="context" data-id="${w.id}" title="View last session context">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="10"/></svg>
        </button>
        <button class="btn btn-sm btn-secondary" data-action="shell" data-id="${w.id}">Shell</button>
        <button class="btn btn-sm btn-ghost" data-action="folder" data-id="${w.id}" title="Open folder">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
        </button>
        <button class="btn btn-sm btn-ghost" data-action="delete" data-id="${w.id}" title="Delete">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m5 0V4a1 1 0 011-1h2a1 1 0 011 1v2"/></svg>
        </button>
      </div>
    </div>`;
}

async function handleCardAction(action, wsId) {
  const ws = state.workspaces.find(w => w.id === wsId);
  if (!ws) return;

  switch (action) {
    case 'launch':
      await openTerminalForWorkspace(ws, true);
      break;
    case 'resume':
      if (ws.sessions && ws.sessions.length > 0) {
        await openTerminalForWorkspace(ws, true, '--continue');
      }
      break;
    case 'shell':
      await openTerminalForWorkspace(ws, false);
      break;
    case 'context':
      await showSessionContext(ws);
      break;
    case 'folder':
      window.api.openInExplorer(ws.path);
      break;
    case 'delete':
      state.deleteTarget = ws;
      dom.deleteWsName.textContent = ws.name;
      dom.modalDelete.classList.add('open');
      break;
  }
}

// ─── Terminal Management ──────────────────────────────────────────────────────

async function openTerminalForWorkspace(ws, launchClaude, customClaudeArgs = null, customCommand = null) {
  const id = `term-${Date.now()}`;

  // Switch to terminals view
  switchView('terminals');

  // Create xterm instance
  const xterm = new Terminal({
    fontFamily: state.config?.terminal?.fontFamily || 'Cascadia Code, Cascadia Mono, Consolas, monospace',
    fontSize:   state.config?.terminal?.fontSize || 14,
    theme: {
      background:          '#0b0d11',
      foreground:          '#e8ecf1',
      cursor:              '#6366f1',
      cursorAccent:        '#0b0d11',
      selectionBackground: 'rgba(99,102,241,0.3)',
      selectionForeground: '#ffffff',
      black:               '#1a1e26',
      red:                 '#ef4444',
      green:               '#22c55e',
      yellow:              '#f59e0b',
      blue:                '#3b82f6',
      magenta:             '#a855f7',
      cyan:                '#06b6d4',
      white:               '#e8ecf1',
      brightBlack:         '#5a6375',
      brightRed:           '#f87171',
      brightGreen:         '#4ade80',
      brightYellow:        '#fbbf24',
      brightBlue:          '#60a5fa',
      brightMagenta:       '#c084fc',
      brightCyan:          '#22d3ee',
      brightWhite:         '#f1f5f9',
    },
    cursorBlink: true,
    allowProposedApi: true,
    scrollback: 10000,
  });

  const fitAddon = new FitAddon();
  xterm.loadAddon(fitAddon);
  xterm.loadAddon(new WebLinksAddon());

  // DOM: terminal container
  const container = document.createElement('div');
  container.className = 'terminal-container';
  container.id = `tc-${id}`;
  dom.terminalArea.appendChild(container);

  // DOM: tab
  const tabEl = document.createElement('button');
  tabEl.className = 'terminal-tab';
  tabEl.dataset.id = id;
  const label = launchClaude ? `Claude: ${ws.name}` : `Shell: ${ws.name}`;
  tabEl.innerHTML = `
    <span class="tab-label">${esc(label)}</span>
    <span class="tab-close" data-close="${id}">&times;</span>
  `;
  dom.terminalTabs.appendChild(tabEl);

  tabEl.addEventListener('click', (e) => {
    if (e.target.closest('.tab-close')) {
      closeTerminal(id);
    } else {
      activateTerminal(id);
    }
  });

  // Store terminal state
  state.terminals.set(id, {
    xterm, fitAddon, container, tabEl,
    workspaceId: ws.id,
    title: label,
  });

  // Activate this terminal
  activateTerminal(id);

  // Open xterm in container
  xterm.open(container);

  // Small delay so the container has dimensions before fitting
  requestAnimationFrame(() => {
    try { fitAddon.fit(); } catch {}

    // Connect to PTY backend
    window.api.createTerminal({
      id,
      cwd: ws.path,
      launchClaude,
      claudeArgs: customClaudeArgs !== null ? customClaudeArgs : (launchClaude ? '' : null),
      customCommand,
    }).then(() => {
      // Send initial size to PTY
      window.api.terminalResize({ id, cols: xterm.cols, rows: xterm.rows });
    });
  });

  // Clipboard: Ctrl+V paste, Ctrl+Shift+C copy, right-click menu
  xterm.attachCustomKeyEventHandler((ev) => {
    if (ev.type !== 'keydown') return true;

    // Ctrl+V → paste
    if (ev.ctrlKey && !ev.shiftKey && ev.key === 'v') {
      const text = window.api.clipboardRead();
      if (text) window.api.terminalInput({ id, data: text });
      return false;
    }

    // Ctrl+Shift+C → copy selection
    if (ev.ctrlKey && ev.shiftKey && ev.key === 'C') {
      const sel = xterm.getSelection();
      if (sel) window.api.clipboardWrite(sel);
      return false;
    }

    // Ctrl+C → if selection exists: copy; otherwise send SIGINT
    if (ev.ctrlKey && !ev.shiftKey && ev.key === 'c') {
      const sel = xterm.getSelection();
      if (sel) {
        window.api.clipboardWrite(sel);
        xterm.clearSelection();
        return false;
      }
    }

    return true;
  });

  // Right-click context menu for copy/paste
  container.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const sel = xterm.getSelection();
    showTerminalContextMenu(e.clientX, e.clientY, sel, id, xterm);
  });

  // Forward keystrokes to PTY
  xterm.onData((data) => {
    window.api.terminalInput({ id, data });
  });

  xterm.onResize(({ cols, rows }) => {
    window.api.terminalResize({ id, cols, rows });
  });

  // Record session
  await window.api.recordSession({ workspaceId: ws.id, terminalId: id });

  // Update badge
  updateTerminalBadge();
}

async function openPlainTerminal() {
  const homeDir = state.config?.defaultBasePath || '';
  const fakeWs = { id: 'system', name: 'Terminal', path: homeDir || '' };
  await openTerminalForWorkspace(fakeWs, false);
}

function activateTerminal(id) {
  state.activeTerminalId = id;

  state.terminals.forEach((t, tid) => {
    const isActive = tid === id;
    t.container.classList.toggle('active', isActive);
    t.tabEl.classList.toggle('active', isActive);
    if (isActive) {
      requestAnimationFrame(() => {
        try { t.fitAddon.fit(); } catch {}
        t.xterm.focus();
      });
    }
  });

  dom.terminalEmpty.style.display = state.terminals.size > 0 ? 'none' : 'flex';
}

function closeTerminal(id) {
  const t = state.terminals.get(id);
  if (!t) return;

  window.api.terminalKill({ id });
  t.xterm.dispose();
  t.container.remove();
  t.tabEl.remove();
  state.terminals.delete(id);

  if (state.activeTerminalId === id) {
    const remaining = [...state.terminals.keys()];
    if (remaining.length > 0) {
      activateTerminal(remaining[remaining.length - 1]);
    } else {
      state.activeTerminalId = null;
      dom.terminalEmpty.style.display = 'flex';
    }
  }

  updateTerminalBadge();
}

function fitActiveTerminal() {
  if (state.activeTerminalId) {
    const t = state.terminals.get(state.activeTerminalId);
    if (t) {
      requestAnimationFrame(() => {
        try { t.fitAddon.fit(); } catch {}
      });
    }
  }
}

function updateTerminalBadge() {
  const n = state.terminals.size;
  dom.terminalCountBadge.textContent = n;
  dom.terminalCountBadge.style.display = n > 0 ? 'inline' : 'none';
}

// ─── Terminal IPC ─────────────────────────────────────────────────────────────

function bindTerminalIPC() {
  window.api.onTerminalData(({ id, data }) => {
    const t = state.terminals.get(id);
    if (t) t.xterm.write(data);
  });

  window.api.onTerminalExit(({ id }) => {
    const t = state.terminals.get(id);
    if (t) {
      t.xterm.writeln('\r\n\x1b[90m[Process exited]\x1b[0m');
    }
  });
}

// ─── Window resize ────────────────────────────────────────────────────────────

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(fitActiveTerminal, 100);
});

// ─── Create Workspace Modal ───────────────────────────────────────────────────

function openNewWorkspaceModal() {
  $('#ws-name').value = '';
  $('#ws-description').value = '';
  $('#ws-constraints').value = '';
  $('#ws-path').value = state.config?.defaultBasePath || '';
  $$('.type-chip').forEach(c => c.classList.toggle('active', c.dataset.type === 'development'));
  dom.modalNewWs.classList.add('open');
  setTimeout(() => $('#ws-name').focus(), 100);
}

function closeNewWorkspaceModal() {
  dom.modalNewWs.classList.remove('open');
}

function getSelectedType() {
  const active = document.querySelector('.type-chip.active');
  return active?.dataset.type || 'general';
}

async function submitNewWorkspace() {
  const name = $('#ws-name').value.trim();
  if (!name) { $('#ws-name').focus(); return; }

  const ws = await window.api.createWorkspace({
    name,
    type: getSelectedType(),
    description: $('#ws-description').value.trim(),
    basePath: $('#ws-path').value.trim() || undefined,
    constraints: $('#ws-constraints').value.trim() || undefined,
  });

  closeNewWorkspaceModal();
  await refreshWorkspaces();
}

// ─── Delete Modal ─────────────────────────────────────────────────────────────

async function confirmDelete() {
  if (!state.deleteTarget) return;
  const deleteFiles = $('#delete-files-check').checked;
  await window.api.deleteWorkspace({ id: state.deleteTarget.id, deleteFiles });
  state.deleteTarget = null;
  dom.modalDelete.classList.remove('open');
  await refreshWorkspaces();
}

// ─── Settings ─────────────────────────────────────────────────────────────────

function loadSettings() {
  if (!state.config) return;
  $('#setting-base-path').value  = state.config.defaultBasePath || '';
  $('#setting-claude-path').value = state.config.claudePath || 'claude';
  $('#setting-font-size').value   = state.config.terminal?.fontSize || 14;
  $('#setting-font-family').value = state.config.terminal?.fontFamily || '';
}

async function saveSettings() {
  state.config = await window.api.saveConfig({
    defaultBasePath: $('#setting-base-path').value,
    claudePath:      $('#setting-claude-path').value,
    terminal: {
      fontSize:   parseInt($('#setting-font-size').value) || 14,
      fontFamily: $('#setting-font-family').value,
    },
  });
}

// ─── Claude Status ────────────────────────────────────────────────────────────

async function checkClaudeStatus() {
  const res = await window.api.checkClaude();
  const dot  = dom.claudeStatus.querySelector('.status-dot');
  const text = dom.claudeStatus.querySelector('.status-text');
  
  if (res.installed) {
    dot.className = 'status-dot online';
    text.textContent = `Claude ${res.version || 'OK'}`;
    
    // Check for updates
    try {
      const latestVersion = await window.api.checkClaudeUpdate();
      if (latestVersion && res.version && latestVersion !== res.version) {
        dom.updateContainer.style.display = 'block';
        dom.btnUpdate.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Update to v${latestVersion}`;
      } else {
        dom.updateContainer.style.display = 'none';
      }
    } catch(e) {
      console.error("Update check failed", e);
    }
  } else {
    dot.className = 'status-dot offline';
    text.textContent = 'Claude not found';
    dom.updateContainer.style.display = 'none';
  }
}

// ─── Events ───────────────────────────────────────────────────────────────────

function bindEvents() {
  // Window controls
  $('#btn-minimize').addEventListener('click', () => window.api.minimize());
  $('#btn-maximize').addEventListener('click', () => window.api.maximize());
  $('#btn-close').addEventListener('click', () => window.api.close());

  window.api.onWindowState((maximized) => {
    $('#icon-maximize').style.display = maximized ? 'none' : 'block';
    $('#icon-restore').style.display  = maximized ? 'block' : 'none';
  });
  
  if (dom.btnUpdate) {
    dom.btnUpdate.addEventListener('click', async () => {
      // Spawn terminal to install update globally
      await openTerminalForWorkspace({ id: 'system', name: 'Update Claude', path: state.config?.defaultBasePath || '' }, false, null, 'npm install -g @anthropic-ai/claude-code');
      dom.updateContainer.style.display = 'none';
    });
  }

  // Navigation
  dom.navBtns.forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  // Dashboard
  $('#btn-new-workspace').addEventListener('click', openNewWorkspaceModal);
  $('#btn-empty-new').addEventListener('click', openNewWorkspaceModal);
  $('#btn-import-workspace').addEventListener('click', async () => {
    const dir = await window.api.selectDirectory();
    if (dir) {
      await window.api.importWorkspace(dir);
      await refreshWorkspaces();
    }
  });

  // New workspace modal
  $('#modal-close-new').addEventListener('click', closeNewWorkspaceModal);
  $('#btn-cancel-ws').addEventListener('click', closeNewWorkspaceModal);
  $('#btn-create-ws').addEventListener('click', submitNewWorkspace);

  dom.modalNewWs.addEventListener('click', (e) => {
    if (e.target === dom.modalNewWs) closeNewWorkspaceModal();
  });

  $$('.type-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      $$('.type-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
    });
  });

  $('#btn-browse-ws').addEventListener('click', async () => {
    const dir = await window.api.selectDirectory();
    if (dir) $('#ws-path').value = dir;
  });

  // Delete modal
  $('#modal-close-delete').addEventListener('click', () => dom.modalDelete.classList.remove('open'));
  $('#btn-cancel-delete').addEventListener('click', () => dom.modalDelete.classList.remove('open'));
  $('#btn-confirm-delete').addEventListener('click', confirmDelete);
  dom.modalDelete.addEventListener('click', (e) => {
    if (e.target === dom.modalDelete) dom.modalDelete.classList.remove('open');
  });

  // Terminals
  $('#btn-new-terminal').addEventListener('click', openPlainTerminal);

  // Settings
  $('#btn-browse-base').addEventListener('click', async () => {
    const dir = await window.api.selectDirectory();
    if (dir) $('#setting-base-path').value = dir;
  });
  $('#btn-save-settings').addEventListener('click', saveSettings);

  // Model Profiles
  $('#btn-add-profile').addEventListener('click', () => openProfileEditor(null));
  $('#modal-close-profile').addEventListener('click', () => dom.modalProfileEditor.classList.remove('open'));
  $('#btn-cancel-profile').addEventListener('click', () => dom.modalProfileEditor.classList.remove('open'));
  $('#btn-save-profile').addEventListener('click', saveProfile);
  dom.modalProfileEditor.addEventListener('click', (e) => {
    if (e.target === dom.modalProfileEditor) dom.modalProfileEditor.classList.remove('open');
  });
  $('#btn-toggle-key').addEventListener('click', () => {
    const inp = $('#profile-api-key');
    inp.type = inp.type === 'password' ? 'text' : 'password';
  });
  dom.sidebarProfileSelect.addEventListener('change', onSidebarProfileChange);

  // Delete profile modal
  $('#modal-close-delete-profile').addEventListener('click', () => dom.modalDeleteProfile.classList.remove('open'));
  $('#btn-cancel-delete-profile').addEventListener('click', () => dom.modalDeleteProfile.classList.remove('open'));
  $('#btn-confirm-delete-profile').addEventListener('click', confirmDeleteProfile);
  dom.modalDeleteProfile.addEventListener('click', (e) => {
    if (e.target === dom.modalDeleteProfile) dom.modalDeleteProfile.classList.remove('open');
  });

  // Session context modal
  $('#modal-close-session').addEventListener('click', () => dom.modalSessionContext.classList.remove('open'));
  $('#btn-close-session').addEventListener('click', () => dom.modalSessionContext.classList.remove('open'));
  dom.modalSessionContext.addEventListener('click', (e) => {
    if (e.target === dom.modalSessionContext) dom.modalSessionContext.classList.remove('open');
  });

  // Skills
  $('#btn-install-skill-git').addEventListener('click', openGitInstallModal);
  $('#btn-install-skill-local').addEventListener('click', installSkillLocal);
  $('#btn-open-skills-folder').addEventListener('click', () => window.api.openSkillsFolder());
  $('#btn-empty-git-install').addEventListener('click', openGitInstallModal);
  $('#btn-empty-local-install').addEventListener('click', installSkillLocal);

  // Git install modal
  $('#modal-close-git').addEventListener('click', () => dom.modalGitInstall.classList.remove('open'));
  $('#btn-cancel-git').addEventListener('click', () => dom.modalGitInstall.classList.remove('open'));
  $('#btn-confirm-git').addEventListener('click', confirmGitInstall);
  dom.modalGitInstall.addEventListener('click', (e) => {
    if (e.target === dom.modalGitInstall) dom.modalGitInstall.classList.remove('open');
  });
  $('#git-url').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') confirmGitInstall();
  });

  // Skill detail modal
  $('#modal-close-detail').addEventListener('click', () => dom.modalSkillDetail.classList.remove('open'));
  $('#btn-close-detail').addEventListener('click', () => dom.modalSkillDetail.classList.remove('open'));
  dom.modalSkillDetail.addEventListener('click', (e) => {
    if (e.target === dom.modalSkillDetail) dom.modalSkillDetail.classList.remove('open');
  });

  // Delete skill modal
  $('#modal-close-delete-skill').addEventListener('click', () => dom.modalDeleteSkill.classList.remove('open'));
  $('#btn-cancel-delete-skill').addEventListener('click', () => dom.modalDeleteSkill.classList.remove('open'));
  $('#btn-confirm-delete-skill').addEventListener('click', confirmDeleteSkill);
  dom.modalDeleteSkill.addEventListener('click', (e) => {
    if (e.target === dom.modalDeleteSkill) dom.modalDeleteSkill.classList.remove('open');
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (dom.modalNewWs.classList.contains('open')) closeNewWorkspaceModal();
      if (dom.modalDelete.classList.contains('open')) dom.modalDelete.classList.remove('open');
      if (dom.modalGitInstall.classList.contains('open')) dom.modalGitInstall.classList.remove('open');
      if (dom.modalSkillDetail.classList.contains('open')) dom.modalSkillDetail.classList.remove('open');
      if (dom.modalDeleteSkill.classList.contains('open')) dom.modalDeleteSkill.classList.remove('open');
      if (dom.modalSessionContext.classList.contains('open')) dom.modalSessionContext.classList.remove('open');
      if (dom.modalProfileEditor.classList.contains('open')) dom.modalProfileEditor.classList.remove('open');
      if (dom.modalDeleteProfile.classList.contains('open')) dom.modalDeleteProfile.classList.remove('open');
    }
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function esc(str) {
  const el = document.createElement('span');
  el.textContent = str || '';
  return el.innerHTML;
}

function timeAgo(iso) {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const min  = Math.floor(diff / 60000);
  if (min < 1)   return 'Just now';
  if (min < 60)  return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24)   return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30)  return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

// ─── Terminal Context Menu ────────────────────────────────────────────────

function showTerminalContextMenu(x, y, selectedText, termId, xterm) {
  removeContextMenu();

  const menu = document.createElement('div');
  menu.className = 'ctx-menu';
  menu.id = 'terminal-ctx-menu';

  const items = [];
  if (selectedText) {
    items.push({ label: 'Copy', icon: 'M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2', action: () => { window.api.clipboardWrite(selectedText); xterm.clearSelection(); }});
  }
  items.push({ label: 'Paste', icon: 'M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2', action: () => { const text = window.api.clipboardRead(); if (text) window.api.terminalInput({ id: termId, data: text }); }});
  items.push({ label: 'Select All', icon: 'M4 7V4h16v3M9 20h6M12 4v16', action: () => xterm.selectAll() });

  menu.innerHTML = items.map(it => `
    <button class="ctx-item">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="${it.icon}"/></svg>
      ${it.label}
    </button>
  `).join('');

  document.body.appendChild(menu);

  const btns = menu.querySelectorAll('.ctx-item');
  items.forEach((it, i) => {
    btns[i].addEventListener('click', () => { it.action(); removeContextMenu(); });
  });

  const rect = menu.getBoundingClientRect();
  if (x + rect.width > window.innerWidth) x = window.innerWidth - rect.width - 8;
  if (y + rect.height > window.innerHeight) y = window.innerHeight - rect.height - 8;
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;

  setTimeout(() => {
    document.addEventListener('click', removeContextMenu, { once: true });
    document.addEventListener('contextmenu', removeContextMenu, { once: true });
  }, 0);
}

function removeContextMenu() {
  const m = document.getElementById('terminal-ctx-menu');
  if (m) m.remove();
}

// ─── Session Context ─────────────────────────────────────────────────────

async function showSessionContext(ws) {
  const modal = dom.modalSessionContext;
  const body = $('#session-context-body');
  const title = $('#session-context-title');

  title.textContent = `${ws.name} - Last Session`;
  body.innerHTML = '<p class="session-loading">Loading session context...</p>';
  modal.classList.add('open');

  const ctx = await window.api.getSessionContext(ws.path);

  if (!ctx) {
    body.innerHTML = `
      <div class="session-empty-ctx">
        <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3">
          <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
        </svg>
        <p>No previous session data found for this workspace.</p>
      </div>`;
    return;
  }

  const userMsgsHtml = ctx.userMessages.length > 0
    ? ctx.userMessages.map(m =>
      `<div class="session-msg session-msg-user"><span class="session-role">You</span><span class="session-text">${esc(m)}</span></div>`
    ).join('')
    : '<p class="text-muted">No user messages found</p>';

  const assistantHtml = ctx.lastAssistantSnippet
    ? `<div class="session-msg session-msg-assistant"><span class="session-role">Claude</span><span class="session-text">${esc(ctx.lastAssistantSnippet)}</span></div>`
    : '';

  body.innerHTML = `
    <div class="session-meta">
      <div class="session-meta-item">
        <span class="session-meta-label">Last active</span>
        <span class="session-meta-value">${esc(ctx.sessionDate)}</span>
      </div>
      <div class="session-meta-item">
        <span class="session-meta-label">Total sessions</span>
        <span class="session-meta-value">${ctx.totalSessions}</span>
      </div>
    </div>
    <h4 class="session-section-title">Conversation Topics</h4>
    <div class="session-msgs-list">${userMsgsHtml}</div>
    ${assistantHtml ? `<h4 class="session-section-title">Last Claude Response</h4>${assistantHtml}` : ''}
  `;
}

// ─── Skills Management ───────────────────────────────────────────────────────

async function refreshSkills() {
  state.skills = await window.api.listSkills();
  renderSkills();
}

function renderSkills() {
  const skills = state.skills || [];
  dom.skillsSubtitle.textContent = `${skills.length} skill${skills.length !== 1 ? 's' : ''} installed`;
  dom.skillsEmpty.style.display = skills.length === 0 ? 'flex' : 'none';
  dom.skillsList.style.display = skills.length === 0 ? 'none' : 'grid';

  dom.skillCountBadge.textContent = skills.length;
  dom.skillCountBadge.style.display = skills.length > 0 ? 'inline' : 'none';

  dom.skillsList.innerHTML = skills
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(s => skillCardHTML(s))
    .join('');

  dom.skillsList.querySelectorAll('[data-skill-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleSkillAction(btn.dataset.skillAction, btn.dataset.skillName);
    });
  });
}

function skillCardHTML(skill) {
  const subCount = skill.subSkills?.length || 0;
  return `
    <div class="skill-card">
      <div class="skill-card-top">
        <div class="skill-card-icon">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/>
          </svg>
        </div>
        <div class="skill-card-info">
          <h3>${esc(skill.name)}</h3>
          ${skill.hasSkillMd
            ? '<span class="skill-badge valid">SKILL.md</span>'
            : '<span class="skill-badge warning">No SKILL.md</span>'}
        </div>
      </div>
      ${skill.description
        ? `<p class="skill-card-desc">${esc(skill.description)}</p>`
        : '<p class="skill-card-desc muted">No description available</p>'}
      ${subCount > 0 ? `<div class="skill-sub-count">${subCount} sub-skill${subCount !== 1 ? 's' : ''}</div>` : ''}
      <div class="skill-card-actions">
        <button class="btn btn-sm btn-secondary" data-skill-action="detail" data-skill-name="${esc(skill.name)}">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          View
        </button>
        <button class="btn btn-sm btn-ghost" data-skill-action="folder" data-skill-name="${esc(skill.name)}" title="Open folder">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
        </button>
        <button class="btn btn-sm btn-ghost skill-delete-btn" data-skill-action="delete" data-skill-name="${esc(skill.name)}" title="Delete">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m5 0V4a1 1 0 011-1h2a1 1 0 011 1v2"/></svg>
        </button>
      </div>
    </div>`;
}

async function handleSkillAction(action, skillName) {
  switch (action) {
    case 'detail':
      await showSkillDetail(skillName);
      break;
    case 'folder': {
      const skillsPath = await window.api.getSkillsPath();
      window.api.openInExplorer(skillsPath + '\\' + skillName);
      break;
    }
    case 'delete':
      state.deleteSkillTarget = skillName;
      $('#delete-skill-name').textContent = skillName;
      dom.modalDeleteSkill.classList.add('open');
      break;
  }
}

async function showSkillDetail(skillName) {
  $('#skill-detail-title').textContent = skillName;
  $('#skill-detail-content').textContent = 'Loading...';
  dom.modalSkillDetail.classList.add('open');

  const res = await window.api.getSkillDetail(skillName);
  if (res.ok) {
    $('#skill-detail-content').textContent = res.content;
  } else {
    $('#skill-detail-content').textContent = `Failed to load: ${res.error}`;
  }
}

function openGitInstallModal() {
  $('#git-url').value = '';
  $('#git-install-status').style.display = 'none';
  $('#btn-confirm-git').disabled = false;
  dom.modalGitInstall.classList.add('open');
  setTimeout(() => $('#git-url').focus(), 100);
}

async function confirmGitInstall() {
  const url = $('#git-url').value.trim();
  if (!url) { $('#git-url').focus(); return; }

  const statusEl = $('#git-install-status');
  const confirmBtn = $('#btn-confirm-git');
  statusEl.style.display = 'block';
  statusEl.className = 'install-status installing';
  statusEl.innerHTML = '<span class="spinner"></span> Cloning repository...';
  confirmBtn.disabled = true;

  const res = await window.api.installSkillGit(url);

  if (res.ok) {
    statusEl.className = 'install-status success';
    statusEl.textContent = `Installed: ${res.installed.join(', ')}`;
    await refreshSkills();
    setTimeout(() => {
      dom.modalGitInstall.classList.remove('open');
    }, 1200);
  } else {
    statusEl.className = 'install-status error';
    statusEl.textContent = res.error;
    confirmBtn.disabled = false;
  }
}

async function installSkillLocal() {
  const dir = await window.api.selectDirectory();
  if (!dir) return;

  const res = await window.api.installSkillLocal(dir);
  if (res.ok) {
    await refreshSkills();
  } else {
    alert(res.error);
  }
}

async function confirmDeleteSkill() {
  if (!state.deleteSkillTarget) return;
  await window.api.deleteSkill(state.deleteSkillTarget);
  state.deleteSkillTarget = null;
  dom.modalDeleteSkill.classList.remove('open');
  await refreshSkills();
}

// ─── Model Providers ─────────────────────────────────────────────────────────

const MODEL_PROVIDERS = [
  {
    id: 'anthropic', name: 'Anthropic', desc: '官方',
    baseUrl: 'https://api.anthropic.com',
    color: '#d97706',
    models: ['claude-sonnet-4-20250514', 'claude-opus-4-20250514', 'claude-haiku-3-20250307'],
    defaultModel: 'claude-sonnet-4-20250514',
  },
  {
    id: 'kimi', name: 'Kimi', desc: '月之暗面',
    baseUrl: 'https://api.moonshot.cn/anthropic',
    color: '#06b6d4',
    models: ['kimi-k2.5'],
    defaultModel: 'kimi-k2.5',
  },
  {
    id: 'zhipu', name: '智谱 GLM', desc: 'ZhiPu Coding Plan',
    baseUrl: 'https://open.bigmodel.cn/api/anthropic',
    color: '#8b5cf6',
    models: ['glm-5.1', 'GLM-4.7', 'GLM-4.5-Air', 'glm-5'],
    defaultModel: 'glm-5.1',
    defaultSlots: { opus: 'glm-5.1', sonnet: 'glm-5.1', haiku: 'GLM-4.5-Air', subagent: 'glm-5.1' },
    defaultCustomEnv: 'API_TIMEOUT_MS=3000000\nCLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1',
  },
  {
    id: 'deepseek', name: 'DeepSeek', desc: '深度求索',
    baseUrl: 'https://api.deepseek.com/anthropic',
    color: '#3b82f6',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    defaultModel: 'deepseek-chat',
    defaultSlots: { opus: 'deepseek-chat', sonnet: 'deepseek-chat', haiku: 'deepseek-chat', subagent: 'deepseek-chat' },
    defaultCustomEnv: 'API_TIMEOUT_MS=600000\nCLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1',
  },
  {
    id: 'qwen', name: '通义千问', desc: '阿里云百炼',
    baseUrl: 'https://dashscope.aliyuncs.com/apps/anthropic',
    color: '#f97316',
    models: ['qwen-max', 'qwen-plus', 'qwen-turbo', 'qwen-long', 'qwen3-235b-a22b'],
    defaultModel: 'qwen-max',
  },
  {
    id: 'openrouter', name: 'OpenRouter', desc: 'Multi-model',
    baseUrl: 'https://openrouter.ai/api',
    color: '#ec4899',
    models: ['anthropic/claude-sonnet-4', 'anthropic/claude-opus-4', 'google/gemini-2.5-pro', 'openai/gpt-4o', 'deepseek/deepseek-r1'],
    defaultModel: 'anthropic/claude-sonnet-4',
  },
  {
    id: 'siliconflow', name: 'SiliconFlow', desc: '硅基流动',
    baseUrl: 'https://api.siliconflow.cn/',
    color: '#14b8a6',
    models: ['deepseek-ai/DeepSeek-V3', 'Qwen/Qwen2.5-72B-Instruct', 'Pro/deepseek-ai/DeepSeek-R1'],
    defaultModel: 'deepseek-ai/DeepSeek-V3',
  },
  {
    id: 'gemini', name: 'Gemini', desc: 'Google AI',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    color: '#4285f4',
    models: ['gemini-2.5-pro', 'gemini-2.5-flash'],
    defaultModel: 'gemini-2.5-pro',
  },
  {
    id: 'minimax', name: 'MiniMax', desc: '海螺AI',
    baseUrl: 'https://api.minimaxi.com/anthropic',
    color: '#ff4d4f',
    models: ['MiniMax-M2.7'],
    defaultModel: 'MiniMax-M2.7',
    defaultSlots: { opus: 'MiniMax-M2.7', sonnet: 'MiniMax-M2.7', haiku: 'MiniMax-M2.7', subagent: 'MiniMax-M2.7' },
    defaultCustomEnv: 'API_TIMEOUT_MS=3000000\nCLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1',
  },
  {
    id: 'custom', name: '自定义', desc: 'Custom',
    baseUrl: '',
    color: '#6b7280',
    models: [],
    defaultModel: '',
  },
];

// ─── Model Profile Management ────────────────────────────────────────────────

function getProfiles() {
  return state.config?.modelProfiles || [];
}

function getActiveProfileId() {
  return state.config?.activeProfileId || null;
}

function renderProfiles() {
  const profiles = getProfiles();
  const activeId = getActiveProfileId();

  dom.profileEmpty.style.display = profiles.length === 0 ? 'block' : 'none';
  dom.profileGrid.style.display = profiles.length === 0 ? 'none' : 'grid';

  dom.profileGrid.innerHTML = profiles.map(p => {
    const provider = MODEL_PROVIDERS.find(pr => pr.id === p.provider) || MODEL_PROVIDERS.at(-1);
    const isActive = p.id === activeId;
    const maskedKey = p.apiKey ? p.apiKey.slice(0, 6) + '...' + p.apiKey.slice(-4) : 'Not set';
    return `
      <div class="profile-card ${isActive ? 'active' : ''}">
        <div class="profile-card-top">
          <div class="provider-dot" style="background:${provider.color}"></div>
          <div class="profile-card-info">
            <h4>${esc(p.name)}</h4>
            <span class="profile-provider-label">${esc(provider.name)}</span>
          </div>
          ${isActive ? '<span class="profile-active-badge">ACTIVE</span>' : ''}
        </div>
        <div class="profile-card-detail">
          <div class="profile-detail-row">
            <span class="detail-label">Model</span>
            <span class="detail-value mono">${esc(p.model || '--')}</span>
          </div>
          <div class="profile-detail-row">
            <span class="detail-label">API Key</span>
            <span class="detail-value mono">${esc(maskedKey)}</span>
          </div>
        </div>
        <div class="profile-card-actions">
          ${isActive
            ? '<button class="btn btn-sm btn-ghost" disabled style="opacity:0.4">Active</button>'
            : `<button class="btn btn-sm btn-secondary" data-profile-action="activate" data-profile-id="${p.id}">Set Active</button>`}
          <button class="btn btn-sm btn-ghost" data-profile-action="edit" data-profile-id="${p.id}">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5z"/></svg>
            Edit
          </button>
          <button class="btn btn-sm btn-ghost profile-delete-btn" data-profile-action="delete" data-profile-id="${p.id}">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m5 0V4a1 1 0 011-1h2a1 1 0 011 1v2"/></svg>
          </button>
        </div>
      </div>`;
  }).join('');

  dom.profileGrid.querySelectorAll('[data-profile-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleProfileAction(btn.dataset.profileAction, btn.dataset.profileId);
    });
  });
}

function renderSidebarProfileSelect() {
  const profiles = getProfiles();
  const activeId = getActiveProfileId();
  const sel = dom.sidebarProfileSelect;

  sel.innerHTML = '<option value="">-- No Profile --</option>' +
    profiles.map(p => {
      const prov = MODEL_PROVIDERS.find(pr => pr.id === p.provider);
      const label = `${p.name} (${p.model || prov?.name || 'Custom'})`;
      return `<option value="${p.id}" ${p.id === activeId ? 'selected' : ''}>${esc(label)}</option>`;
    }).join('');
}

async function handleProfileAction(action, profileId) {
  switch (action) {
    case 'activate':
      state.config = await window.api.saveConfig({ activeProfileId: profileId });
      renderProfiles();
      renderSidebarProfileSelect();
      break;
    case 'edit':
      openProfileEditor(profileId);
      break;
    case 'delete':
      state.deleteProfileTarget = profileId;
      const p = getProfiles().find(pr => pr.id === profileId);
      $('#delete-profile-name').textContent = p?.name || profileId;
      dom.modalDeleteProfile.classList.add('open');
      break;
  }
}

async function confirmDeleteProfile() {
  if (!state.deleteProfileTarget) return;
  const profiles = getProfiles().filter(p => p.id !== state.deleteProfileTarget);
  const activeId = getActiveProfileId() === state.deleteProfileTarget ? (profiles[0]?.id || null) : getActiveProfileId();
  state.config = await window.api.saveConfig({ modelProfiles: profiles, activeProfileId: activeId });
  state.deleteProfileTarget = null;
  dom.modalDeleteProfile.classList.remove('open');
  renderProfiles();
  renderSidebarProfileSelect();
}

// ─── Profile Editor ──────────────────────────────────────────────────────────

let editingProfileId = null;

function renderProviderChips() {
  const container = $('#provider-selector');
  container.innerHTML = MODEL_PROVIDERS.map(p =>
    `<button class="provider-chip" data-provider="${p.id}" style="--chip-color:${p.color}">
      <span class="provider-chip-dot" style="background:${p.color}"></span>
      ${esc(p.name)}
      <span class="provider-chip-desc">${esc(p.desc)}</span>
    </button>`
  ).join('');

  container.querySelectorAll('.provider-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      container.querySelectorAll('.provider-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      applyProviderPreset(chip.dataset.provider);
    });
  });
}

function applyProviderPreset(providerId) {
  const prov = MODEL_PROVIDERS.find(p => p.id === providerId);
  if (!prov) return;

  $('#profile-base-url').value = prov.baseUrl;

  if (!editingProfileId) {
    if (prov.defaultModel) $('#profile-model').value = prov.defaultModel;

    if (prov.defaultSlots) {
      $('#profile-opus').value = prov.defaultSlots.opus || '';
      $('#profile-sonnet').value = prov.defaultSlots.sonnet || '';
      $('#profile-haiku').value = prov.defaultSlots.haiku || '';
    } else {
      $('#profile-opus').value = '';
      $('#profile-sonnet').value = '';
      $('#profile-haiku').value = '';
    }

    $('#profile-custom-env').value = prov.defaultCustomEnv || '';
  }

  const suggestions = $('#model-suggestions');
  suggestions.innerHTML = prov.models.map(m => `<option value="${m}">`).join('');
}

function openProfileEditor(profileId) {
  editingProfileId = profileId || null;
  const isEdit = !!profileId;

  $('#profile-editor-title').textContent = isEdit ? 'Edit Model Profile' : 'Add Model Profile';
  renderProviderChips();

  if (isEdit) {
    const p = getProfiles().find(pr => pr.id === profileId);
    if (!p) return;
    $('#profile-name').value = p.name;
    $('#profile-base-url').value = p.baseUrl;
    $('#profile-api-key').value = p.apiKey;
    $('#profile-model').value = p.model;
    $('#profile-opus').value = p.opusModel || '';
    $('#profile-sonnet').value = p.sonnetModel || '';
    $('#profile-haiku').value = p.haikuModel || '';
    $('#profile-subagent').value = p.subagentModel || '';
    $('#profile-custom-env').value = p.customEnv || '';

    const chipEl = $(`[data-provider="${p.provider}"]`);
    if (chipEl) {
      chipEl.classList.add('active');
      const prov = MODEL_PROVIDERS.find(pr => pr.id === p.provider);
      if (prov) {
        $('#model-suggestions').innerHTML = prov.models.map(m => `<option value="${m}">`).join('');
      }
    }
  } else {
    $('#profile-name').value = '';
    $('#profile-base-url').value = '';
    $('#profile-api-key').value = '';
    $('#profile-model').value = '';
    $('#profile-opus').value = '';
    $('#profile-sonnet').value = '';
    $('#profile-haiku').value = '';
    $('#profile-subagent').value = '';
    $('#profile-custom-env').value = '';
    $('#model-suggestions').innerHTML = '';
  }

  $('#profile-api-key').type = 'password';
  dom.modalProfileEditor.classList.add('open');
  setTimeout(() => $('#profile-name').focus(), 100);
}

function getSelectedProvider() {
  const active = document.querySelector('.provider-chip.active');
  return active?.dataset.provider || 'custom';
}

async function saveProfile() {
  const name = $('#profile-name').value.trim();
  if (!name) { $('#profile-name').focus(); return; }

  const mainModel = $('#profile-model').value.trim();
  const profileData = {
    id: editingProfileId || `profile-${Date.now()}`,
    name,
    provider: getSelectedProvider(),
    baseUrl: $('#profile-base-url').value.trim(),
    apiKey: $('#profile-api-key').value.trim(),
    model: mainModel,
    opusModel: $('#profile-opus').value.trim() || mainModel,
    sonnetModel: $('#profile-sonnet').value.trim() || mainModel,
    haikuModel: $('#profile-haiku').value.trim() || mainModel,
    subagentModel: $('#profile-subagent').value.trim() || mainModel,
    customEnv: $('#profile-custom-env').value.trim(),
  };

  const profiles = [...getProfiles()];
  const idx = profiles.findIndex(p => p.id === profileData.id);
  if (idx >= 0) {
    profiles[idx] = profileData;
  } else {
    profiles.push(profileData);
  }

  const update = { modelProfiles: profiles };
  if (!getActiveProfileId() || profiles.length === 1) {
    update.activeProfileId = profileData.id;
  }

  state.config = await window.api.saveConfig(update);
  editingProfileId = null;
  dom.modalProfileEditor.classList.remove('open');
  renderProfiles();
  renderSidebarProfileSelect();
}

async function onSidebarProfileChange() {
  const selectedId = dom.sidebarProfileSelect.value || null;
  state.config = await window.api.saveConfig({ activeProfileId: selectedId });
  renderProfiles();
}
