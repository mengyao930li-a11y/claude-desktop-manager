# Claude Code Desktop Manager

A desktop application for managing Claude Code workspaces and sessions with **full terminal functionality**. Built with Electron + node-pty + xterm.js.

## Architecture: Why node-pty?

Claude Code is a full terminal application that requires a real PTY (pseudo-terminal) to function correctly. Simple `child_process.spawn` with piped stdio **breaks** Claude Code's interactive features:

- ANSI color rendering
- Cursor movement and inline editing
- Tool approval prompts
- Progress indicators
- Multi-line input

This app uses **node-pty** to create real pseudo-terminals, and **xterm.js** to render them in the browser. Claude Code runs unmodified with **100% feature parity**.

```
┌─────────────────────────────────────────┐
│  Electron (Renderer)                    │
│  ┌───────────────┐                      │
│  │   xterm.js    │ ◄── full terminal    │
│  │               │     rendering        │
│  └───────┬───────┘                      │
│          │ IPC (keystrokes / data)       │
├──────────┼──────────────────────────────┤
│  Electron (Main)                        │
│  ┌───────┴───────┐                      │
│  │   node-pty    │ ◄── real PTY         │
│  │               │     (pseudo-terminal)│
│  └───────┬───────┘                      │
│          │                              │
│  ┌───────┴───────┐                      │
│  │  Claude Code  │ ◄── runs unmodified  │
│  │  (full CLI)   │     100% features    │
│  └───────────────┘                      │
└─────────────────────────────────────────┘
```

## Prerequisites

1. **Node.js** >= 18 (https://nodejs.org)
2. **Claude Code** CLI installed and available in PATH (`npm install -g @anthropic-ai/claude-code`)
3. **Visual Studio Build Tools** with "Desktop development with C++" workload (for node-pty native compilation)

## Installation

```powershell
cd claude-desktop-manager
npm install
```

The `postinstall` script automatically:
1. Patches node-gyp for VS 2025 compatibility (if needed)
2. Rebuilds `node-pty` for Electron's Node.js version

**Note for VS 2025 users**: The `scripts/patch-node-gyp.js` script automatically adds VS 18 (2025) support and disables Spectre mitigation requirement. If you use VS 2022 or older, the patch is harmless.

If `postinstall` fails, you may need to set the `VCTargetsPath` environment variable:
```powershell
$env:VCTargetsPath = "C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\MSBuild\Microsoft\VC\v180\"
npm run rebuild
```

## Usage

```powershell
npm start
```

### Features

- **Workspace Management**: Create project workspaces with auto-generated directory structure and CLAUDE.md configuration
- **One-Click Claude Launch**: Launch Claude Code in any workspace with a single click
- **Multiple Terminal Tabs**: Run multiple Claude Code sessions simultaneously
- **Full Terminal Support**: 256-color, Unicode, cursor movement, interactive prompts — everything works
- **Shell Access**: Open plain shell terminals alongside Claude Code
- **Session Tracking**: Automatic session history per workspace
- **Import Existing Projects**: Import any directory as a workspace

### Auto-Generated Workspace Structure

```
workspace-name/
├── .claude/
│   ├── CLAUDE.md        # Project instructions for Claude Code
│   └── skills/          # Project-specific skills
├── context/
│   ├── requirements.md  # Project requirements
│   ├── research/        # Research materials
│   └── references/      # Reference files
├── sessions/
│   └── archive/         # Session history
└── output/              # Build artifacts
```

## Development

```powershell
# Build renderer bundle
npm run build

# Start app
npm start

# Rebuild native modules after Electron version change
npm run rebuild
```

## Packaging (Production)

To package as a standalone desktop app, add electron-builder:

```powershell
npm install --save-dev electron-builder
```

Add to package.json:
```json
{
  "build": {
    "appId": "com.claude.desktop-manager",
    "productName": "Claude Code Manager",
    "files": ["main.js", "preload.js", "src/**/*", "dist/**/*"],
    "win": { "target": "nsis" }
  }
}
```

Then build:
```powershell
npx electron-builder --win
```

## License

MIT
