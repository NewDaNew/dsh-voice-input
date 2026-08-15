# 🎤 dsh-plugin-voice-input — DeepSeek Harness 语音输入插件

在 DeepSeek Harness Web 界面的对话输入框右侧添加一个**麦克风按钮**：点击后直接说话，
语音自动转成文字填入输入框，支持可选「识别后自动发送」。

基于浏览器内置的 **Web Speech API** 实现——语音在本地浏览器识别，**不需要服务器、不需要 API Key、不上传任何语音数据**。

## ✨ 功能

| 功能 | 说明 |
|---|---|
| 🎤 一键语音输入 | 点击麦克风开始聆听（说完自动停止），实时转写气泡显示在按钮上方，识别结果自动填入输入框 |
| ⏹ 手动停止 | 再次点击麦克风立即停止，并把当前内容提交到输入框 |
| ⚙️ 设置菜单 | 按钮右侧小箭头打开：**识别后自动发送** 开关、**识别语言**（自动 / 中文 / English），偏好保存在浏览器本地 |
| 🛡️ 兼容性检测 | 浏览器不支持语音识别时按钮自动禁用并给出提示 |

## 📦 安装（3 步）

> 要求：DSH `0.1.0-rc.6+` 的 `web` profile；Chrome / Edge 等支持 Web Speech API 的浏览器。

**第 1 步：把插件放到 DSH 可解析的位置**

把本仓库内容（含 `package.json`）放在任意目录，例如 `D:\plugins\dsh-plugin-voice-input`。

**第 2 步：复制到 web profile 的 node_modules**

在 PowerShell 中执行（把 `D:\plugins\dsh-plugin-voice-input` 换成你的实际路径）：

```powershell
$dst = "$env:DSH_HOME\profiles\node_modules\@local\dsh-plugin-voice-input"
New-Item -ItemType Directory -Force -Path (Split-Path $dst) | Out-Null
Copy-Item -Recurse -Force "D:\plugins\dsh-plugin-voice-input" $dst
```

> 没有设置过 `DSH_HOME` 的话，它默认是 `C:\Users\你的用户名\.dsh`。

**第 3 步：在 profile 中注册插件**

编辑 `$env:DSH_HOME\profiles\web\cordis.patch.yml`，在文件末尾追加：

```yaml
# 语音输入插件
- insert:
    - id: voice-input
      name: '@local/dsh-plugin-voice-input'
```

**第 4 步：重启生效**

结束当前 `dsh web` 进程，重新运行 `dsh web`，然后**刷新浏览器页面**。
打开任意对话，输入框右侧（模型选择器旁边）就会出现 🎤 麦克风按钮。

## 🎙️ 使用

1. 点击 🎤 开始聆听，气泡中会实时显示转写内容
2. 说完自动停止，文字自动填入输入框；或再点一次立即停止
3. 想自动发送？点右侧 ⚙️ 打开设置，打开「识别后自动发送」即可

## 🔧 说明与限制

- 语音识别使用浏览器 `SpeechRecognition` API，**语音数据仅在本地浏览器处理**，不会发送到 DSH 服务器
- 未进入会话（hero 状态/未选择工作区）时不显示麦克风按钮
- 消息提交/裁定阶段按钮暂时禁用，避免干扰进行中的请求
- 识别语言默认跟随浏览器语言（中文系统自动用 zh-CN）

## 📁 文件结构

```
dsh-plugin-voice-input/
├── package.json       # 插件声明（dsh.client + exports）
└── lib/
    ├── index.js       # 服务端 no-op 入口（loader 需要）
    └── client.js      # 浏览器端插件（麦克风按钮 + 语音识别）
```

## 🧩 原理（给开发者）

- 插件是 DSH 的 **client plugin**：`package.json` 声明 `dsh.client`（platform=web，inject 依赖 runtime 与 ui-conversation），`exports["./client"]` 指向浏览器端 bundle
- DSH 的 client-modules 会把它注入 `window.__DSH_BOOT__`，通过 `/plugins/@local/dsh-plugin-voice-input/client.js` 提供给前端
- 插件在 `apply(ctx)` 中通过 `ctx.slots.inject("conversation.input.right", …)` 把麦克风按钮注册到输入框右侧工具栏，识别结果通过标准 `inputActions.setDraft()` 写入草稿
