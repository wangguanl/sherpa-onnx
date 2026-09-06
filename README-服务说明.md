# sherpa-onnx 语音识别服务说明

统一入口是 `start.ps1`，用 `-Service` 选择流式或离线。两种服务是独立进程，端口不同，可以同时开。

## 一、服务功能总览

| 功能 | 启动命令 | 默认端口起点 | 访问地址 |
|------|---------|-------------|---------|
| 流式麦克风识别 | `pwsh -NoProfile -File .\start.ps1 -Service streaming` | 6006 | http://localhost:6006/streaming_record.html |
| 离线录音识别 | `pwsh -NoProfile -File .\start.ps1` | 6007 | http://localhost:6007/offline_record.html |
| 上传文件识别 | 同上（同一个离线服务） | 6007 | http://localhost:6007/upload.html |
| 官方样例 wav 自检 | `pwsh -NoProfile -File .\start.ps1 -Service cli` | 无 | 终端打印识别结果 |

> 离线录音和上传文件由同一个离线服务承载，只是页面不同。端口占用时脚本会 +1 顺延，以启动日志为准。

## 二、启动

```powershell
pwsh -NoProfile -File .\start.ps1
pwsh -NoProfile -File .\start.ps1 -Service streaming
pwsh -NoProfile -File .\start.ps1 -Service cli
```

- 流式：模型 `E:\huggingface_cache\sherpa-onnx-streaming-zh-en`（int8 zipformer，中英）
- 离线：模型 `E:\huggingface_cache\sherpa-onnx-sense-voice`（int8 SenseVoice）

## 三、脚本说明

`start.ps1` 会：

1. 不足 PowerShell 7 时转交给 `pwsh`
2. 把本机 ffmpeg 加入当前会话 PATH
3. 检查 `.venv` 与模型文件
4. 从建议端口起探测，占用则顺延
5. 启动后打印实际端口和页面地址

更完整的本机命令见 `RUN.md`。

## 四、前提条件

- Python 虚拟环境：`E:\Pro2\sherpa-onnx\.venv`（已装 `sherpa-onnx`、`sounddevice`、`websockets` 12.0 等）
- 模型目录：`E:\huggingface_cache`

## 五、常见问题

- **端口被占用**：脚本自动顺延，看启动日志里的实际端口。
- **浏览器无法使用麦克风**：未配 HTTPS，麦克风只能在 `localhost` 下用。
- **GPU 加速**：当前是 CPU 轮子，`--provider cpu`。要 GPU 需换 CUDA 版 Python 包。
- **提示禁止运行脚本**：先执行 `Set-ExecutionPolicy -Scope Process Bypass`

## 六、停止服务

在对应终端按 `Ctrl + C`。
