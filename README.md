🤖 Claude Code Desktop Manager
一个为你打造的最优雅、极其易用的本地 Claude Code 图形化终端与工作区管理器！

Node.js 18+Electronxterm.js

Claude Code 是 Anthropic 官方推出的强大 AI 编程助手，但其纯命令行的形态给不少开发者带来了门槛（尤其是繁琐的底层 API 环境变量配置和多项目隔离）。 本项目完美解决了这些痛点，让你零门槛通过精美的 UI 和内置 PTY 终端畅享 Claude Code 的编程魔法。

✨ 核心亮点 (Features)
🎨 一键开启，无缝连接：通过直观的卡片式 UI 管理你所有的代码工作区，一键启动 Claude Code 编程环境。
🔄 智能下文恢复 (Resume)：无需再向 AI 费力重复上一次的进度，一键集成 --continue 参数回到离开时的现场。
⚡ 极其强大的第三方大模型集成：告别修改 ~/.claude/settings.json 的噩梦。应用内直接下拉免配置切换：
DeepSeek (深度求索) - 带官方推荐超时参数保护
Qwen (阿里云百炼)
Kimi (月之暗面)
SiliconFlow (硅基流动)
MiniMax (海螺AI)
OpenRouter (全网聚合)
Google Gemini
💻 底层真终端级体验：依托底层的 node-pty + xterm，无论语法高亮、自动补全、原生键盘钩子还是交互输入，100% 还原原生 CLI 的全火力功能。
🚀 静默全自动升级：内置 NPM 接口扫描，当 Anthropic 官方有了新动作，一键弹框为你执行 npm 全局无感升级。
🛠️ 如何安装与使用 (Installation)
环境要求 (Prerequisites)
确保电脑已安装 Node.js (推荐 V18 或更高版本)。
本软件是 Claude Code 的“座驾”，请确保你已在全局安装了引擎：
bash
npm install -g @anthropic-ai/claude-code
快速开始 (Getting Started)
👉 第一步：克隆/下载代码

将本仓库下载到你的本地任意位置，然后在终端（或 CMD/PowerShell）里进入该目录：

bash
git clone https://github.com/你的用户名/claude-desktop-manager.git
cd claude-desktop-manager
👉 第二步：安装底层依赖

bash
npm install
(注：安装过程中会自动触发底层的 c++ 终端渲染库 node-pty 构建)

👉 第三步：启动软件！

bash
npm start
📸 运行截图 (Screenshots)
💡 小贴士：请在这里通过 GitHub 网页拖拽长传几张你软件的精美截图（比如：首屏工作区列表、设置界面的模型选择下拉框、或者那个酷炫的内置终端界面），让大家一眼种草。

主工作区预览

多模型免密切换

⚙️ 进阶操作：打包为绿色的 exe 应用包 (Build)
如果你想彻底摆脱命令窗口，把软件变相编译成一个可以直接双击的 .exe 原生程序（方便发给同事们直接使用），只需运行：

bash
# 这一步会自动调用 electron-builder，并在你目录里的 dist/ 文件夹下生成安装包！
npm install --save-dev electron-builder
npx electron-builder --win
📝 贡献与支持
觉得有用的朋友欢迎点亮右上角的 ⭐️ Star！如果你发现了适配新型大模型的方案（或者遇到了终端 bug），非常欢迎提交 Pull Request。



