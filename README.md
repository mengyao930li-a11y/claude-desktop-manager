Claude Code Desktop Manager
A powerful, open-source Electron-based GUI for Anthropic's Claude Code. This desktop manager provides an elegant, highly functional wrapper around the Claude CLI, designed specifically for developers who want a better local AI coding experience.

✨ Key Features
1. Visual Workspace Management
Manage multiple project workspaces visually.
One-click launch to open Claude Code within any workspace.
Seamlessly resume previous Claude Code sessions to maintain context (--continue integration).
2. Built-in PTY Terminal
Full xterm.js integration directly within the UI.
No need to open separate external terminal windows.
Execute raw shell commands or chat with Claude Code natively with syntax highlighting and perfect rendering.
3. Ultimate API Provider Switching
Intelligently manages Claude Code's environment variables (ANTHROPIC_BASE_URL, ANTHROPIC_API_KEY, etc.).
Pre-configured defaults for natively interacting with standard and custom Anthropic-compatible APIs:
Anthropic (Official)
DeepSeek (深度求索)
Kimi / Moonshot (月之暗面)
Qwen (阿里云百炼)
SiliconFlow (硅基流动)
MiniMax (海螺AI)
OpenRouter (Multi-model routing)
Gemini (Google AI)
Special handling for unique API auth requirements (e.g., OpenRouter token mapping).
4. Skill Management UI
Visually browse, install, and delete Claude Code Skills.
Supports 1-click Git installation or importing local skill directories.
5. Auto-Updater
The manager operates in the background to automatically check NPM for new @anthropic-ai/claude-code core package releases.
Installs updates globally with a single click from the UI.
🚀 Why Open Source This?
Claude Code is a revolutionary CLI tool, but handling environment variables, switching between model providers (like DeepSeek or Kimi for cost savings), and managing isolated projects in the terminal can be tedious.

This Desktop Manager completely solves those pain points by wrapping the CLI in a beautiful, responsive GUI. Open-sourcing this project on GitHub will directly help thousands of developers who want to use Claude Code locally with alternative, highly-capable models, without struggling with bash scripts or terminal configs.

🛠️ Tech Stack
Core: Electron, Node.js
Frontend: Vanilla HTML/JS/CSS, esbuild
Terminal System: node-pty, xterm.js
Ready for GitHub: The codebase is well-structured, doesn't rely on bloated front-end frameworks, and handles complex process management smoothly. Add some setup instructions to this 
README.md
, and it's absolutely ready for the public!

