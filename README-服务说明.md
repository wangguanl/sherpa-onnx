# sherpa-onnx 语音识别服务说明

本目录针对 sherpa-onnx 项目的语音识别服务进行了封装，提供两个可独立启动的服务脚本，满足**流式识别**与**离线识别**两种场景。

## 一、服务功能总览

| 功能 | 服务脚本 | 端口 | 访问地址 | 前端页面 |
|------|---------|------|---------|---------|
| 流式麦克风识别 | `start-streaming-server.ps1` | 6006 | http://localhost:6006 | Streaming-Record |
| 离线录音识别 | `start-offline-server.ps1` | 6007 | http://localhost:6007 | Offline-Record |
| 上传文件识别 | `start-offline-server.ps1` | 6007 | http://localhost:6007/upload.html | Upload |

> 说明：`Offline-Record`（录音）和 `Upload`（上传文件）由同一个离线服务承载，只是前端页面不同。

两个服务是**独立进程**，端口不同，**可以同时启动、同时使用**。

## 二、启动脚本

### 1. 流式识别服务（Streaming）

```powershell
.\start-streaming-server.ps1
```

- 模型：`sherpa-onnx-streaming-zh-en`（int8 流式 zipformer，中英双语）
- 特点：边说边识别，实时回显文字
- 页面：http://localhost:6006

### 2. 离线识别服务（Non-Streaming）

```powershell
.\start-offline-server.ps1
```

- 模型：`sherpa-onnx-sense-voice`（int8 离线 SenseVoice）
- 特点：整体识别，精度更高，支持录音与上传文件
- 页面：http://localhost:6007

## 三、脚本说明

每个脚本内置了以下逻辑：

1. **自动合并 PATH**：Trae 代理终端会精简 PATH，脚本会重新合并系统/用户 PATH 及常用工具目录（git、node、ffmpeg 等），确保 `python` 等命令可用。
2. **固定路径**：项目根目录 `E:\Pro2\sherpa-onnx`、虚拟环境 `.venv`、模型目录 `E:\huggingface_cache`、Web 前端根目录均已写死，无需手动指定。
3. **启动提示**：启动后打印访问地址。

## 四、前提条件

- Python 虚拟环境位于 `E:\Pro2\sherpa-onnx\.venv`，已安装 `sherpa-onnx`、`sounddevice`、`websockets`（12.0）等依赖。
- 模型已下载到 `E:\huggingface_cache`：
  - `sherpa-onnx-streaming-zh-en`（流式）
  - `sherpa-onnx-sense-voice`（离线）

## 五、常见问题

- **端口被占用**：若 6006/6007 已被占用，修改脚本中的 `$Port` 变量换端口，并同步更新访问地址。
- **浏览器无法使用麦克风**：服务未配置 HTTPS 证书，浏览器麦克风只能在 `localhost` 下使用，不能用公网 IP 直接访问麦克风页面。
- **GPU 加速**：当前 Python 接口的 `sherpa-onnx` 包为 CPU 版，`$Provider` 默认 `cpu`。需 GPU 时请使用 CUDA 版 Python 包或 C++ 的可执行文件（`build-cuda`）。
- **脚本运行提示"禁止运行脚本"**：若 PowerShell 策略限制，先执行：
  ```powershell
  Set-ExecutionPolicy -Scope Process Bypass
  ```

## 六、停止服务

在对应终端窗口按 `Ctrl + C` 即可停止该服务。