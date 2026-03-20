<div align="center">
  <h1>🤖 Claude Code Desktop Manager</h1>
  <p><strong>一个为你打造的最优雅、极其易用的本地 Claude Code 图形化终端与工作区管理器！</strong></p>
  <img src="https://img.shields.io/badge/Node.js-%E2%89%A5%2018-brightgreen" alt="Node.js 18+">
  <img src="https://img.shields.io/badge/Electron-Desktop-blue" alt="Electron">
  <img src="https://img.shields.io/badge/Terminal-xterm.js-orange" alt="xterm.js">
</div>
<br/>

> **[Claude Code](https://docs.claude.com/en/docs/claude-code/setup)** 是 Anthropic 官方推出的强大 AI 编程助手，但其纯命令行的形态给不少开发者带来了门槛（尤其是繁琐的底层 API 环境变量配置和多项目隔离）。
> 本项目完美解决了这些痛点，让你零门槛通过精美的 UI 面板、可视化工具库和内置 PTY 终端，畅享 Claude Code 的极致编程魔法。

---

## ✨ 面板全功能详解 (Features)

作为一个强大的控制中心，本软件的左侧菜单面板为您提供了以下五大核心控制区：

### 1. 📂 工作区总览 (Workspaces)
- **多项目隔离管理**：在这里，你可以将任何本地文件夹一键导入为独立的工作区，每一个项目的工作记录互不干扰。
- **智能对话恢复 (Resume)**：在每个项目的卡片上，你可以使用全新的 `Resume` 按钮自动加上 `--continue` 参数，一键穿越回该项目上一次与 Claude 断开交流时的现场，不用重新说明背景！
- **快捷唤起终端**：点击卡片直达专属终端环境。

### 2. 💻 内置独立终端 (Terminals)
- **真正的原生体验**：这里不是简单的进程拦截，而是依托底层的 `node-pty` + `xterm` 构建的**纯血 PTY 终端**！
- **原汁原味**：你可以拥有和 Mac Terminal、VSCode Terminal 完全一样的体验——极其丝滑的指令悬浮高亮反馈、原生键盘快捷键打断，甚至可以执行 `git` 提交和其他原生系统脚本操作。

### 3. 🛠️ 专属技能商店 (Skills)
Claude Code 最强大之处在于它的扩展能力，而我们为你提供了一个**可视化技能包裹库**：
- **概览清单**：全盘罗列当前已被你的系统安装的所有 MCP 增强包和辅助构建技能（Skills）。
- **一键导入本地能力库**：你可以选中电脑上的某个本地文件夹，直接让它成为一个常驻技能！
- **一键下载 Git 远程技能**：在面板中输入 GitHub 的远程技能链接（如 `@anthropic-ai/claude-code-tools` 等），软件会自动帮你执行拉取、配置并全局挂载。
- **快速卸载清理**：点选不需要的过期拓展，一键删除，再也不用手动去翻那些隐藏的 dotfiles（如 `~/.claude/skills`）。

### 4. ⚙️ 全局设置 - 大模型换路 (Settings)
告别手写修改 `~/.claude/settings.json` 的噩梦。应用内面板为你预置了完美匹配 Claude Code 环境规则的第三方强大下位平替模型。**彻底解决 Auth 规则不一而足的对接深坑！**你可以直接下拉免配置切换：
- **DeepSeek** (深度求索) - *带官方推荐超时参数保护*
- **Qwen** (阿里云百炼)
- **Kimi** (月之暗面) 
- **SiliconFlow** (硅基流动)
- **MiniMax** (海螺AI)
- **OpenRouter** (全网聚合)
- **Google Gemini** 

### 5. 🚀 自动化无感升级模块
- 左下角会实时监测 npm 全局镜像中的 `@anthropic-ai/claude-code` 核心组件信息。一旦官方发布重大更新，你会立刻看到一个 `Update Available` 按钮。
- **一键静默覆盖**，确保你的核心引擎永远拥有最新的战斗能力。

---

## 🛠️ 如何安装与使用 (Installation)

### 环境要求 (Prerequisites)
1. 确保电脑已安装 [Node.js](https://nodejs.org) (推荐 V18 或更高版本)。
2. 本软件是 Claude Code 的“座驾”，请确保你已在全局安装了引擎：
   ```bash
   npm install -g @anthropic-ai/claude-code
   ```

### 快速开始 (Getting Started)

> **👉 第一步：克隆/下载代码**

将本仓库克隆或者下载到你的本地，然后在终端里进入该目录：

```bash
git clone https://github.com/mengyao930li-a11y/claude-desktop-manager.git
cd claude-desktop-manager
```

> **👉 第二步：安装底层依赖**

```bash
npm install
```
*(注：安装过程中会自动触发底层的 c++ 终端渲染库 `node-pty` 构建)*

> **👉 第三步：启动软件！**

```bash
npm start
```

> **🎉 彩蛋（强烈推荐）：一键生成桌面快捷方式！**
> 
> 以后不想每次都苦哈哈地打开命令窗口敲 `npm start`？
> 只需在下载好的 `claude-desktop-manager` 文件夹中找到 **`create_shortcut.bat`**，直接**双击运行它**！
> 嘭！你的 Windows 桌面上就会立刻生成一个带有原生手感的应用图标供你随后双击使用了！（静默后台启动，不会弹出任何烦人的黑框哦~）

---

## 📸 运行截图 (Screenshots)

> 请在这里上传你的面板截图，向访客秀出你强大的功能界面：

- **强大的可视化工作区列表**
![在这里替换截图链接]

- **海量模型一键平替与本地技能库管理中心**
![在这里替换截图链接]

- **完美的 PTY 原生输入交互终端**
![在这里替换截图链接]

---

## ⚙️ 进阶操作：打包为可执行程序 (Build EXE)

如果你想把软件彻底打包成一个可以直接双击打开的 Windows `.exe` 或者 Mac `.dmg` 安裝包，只需运行：

```bash
npm install --save-dev electron-builder
npx electron-builder --win
```

---

## 📝 贡献与支持
觉得有用的朋友欢迎点亮右上角的 ⭐️ **Star**！如果在使用中获得了帮助，或者对如何添加更多种类的平替模型拥有新的见解，欢迎提交 Issue 或者是 PR 以建立更友好的生态！

## 📄 许可证 (License)
MIT License.
