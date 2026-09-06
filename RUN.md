# 运行命令

- 项目：sherpa-onnx（本地语音识别 / 合成工具库）
- 生成时间：2026-09-06
- 运行方式：直接运行
- 硬件评估：满足（结论 + 依据）
  - 官方：Python 预编译轮子默认 CPU；SenseVoice int8 约 228MB，文档示例可在 Cortex A55 单核上跑
  - 本机：RTX 4080 16GB（当时占用约 4.3GB、剩余约 11.6GB），内存 32GB（空闲约 15GB），E 盘剩余约 723GB
  - 缺口：无。GPU 是可选项，不是门槛。本机 `nvcc` 不在 PATH，沿用官方 Method 1 CPU 轮子（已装 `sherpa-onnx==1.13.5`），不装 CUDA 轮子

## 环境准备

全局已有 `pwsh` 7.6.5、`uv`、Python 3.10.11、ffmpeg。仓库 `.venv` 与模型缓存已就绪，不必重装。

```powershell
# 仅在 .venv 缺失时执行（Python 3.10/3.12，不要用系统 3.14）
# PyPI 本机探测约 0.9s，直连；清华源更快时可改 --index-url
uv venv --python 3.10 .venv
uv pip install --python .\.venv\Scripts\python.exe sherpa-onnx soundfile numpy "websockets==12.0" sounddevice
```

模型已在 `E:\huggingface_cache`（Hugging Face 官方可达，未走镜像）：

- `E:\huggingface_cache\sherpa-onnx-sense-voice`（离线 SenseVoice，含 `model.int8.onnx` 与 `test_wavs`）
- `E:\huggingface_cache\sherpa-onnx-streaming-zh-en`（流式 zipformer 中英）

缺失时用 `hf` 拉取：

```powershell
hf download csukuangfj/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17 --local-dir E:\huggingface_cache\sherpa-onnx-sense-voice
hf download csukuangfj/sherpa-onnx-streaming-zipformer-bilingual-zh-en-2023-02-20 --local-dir E:\huggingface_cache\sherpa-onnx-streaming-zh-en
```

或从 GitHub Release（本机探测约 2.7s，直连）：

```powershell
# https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2024-07-17.tar.bz2
```

## 启动

- 推荐：`pwsh -NoProfile -File .\start.ps1`
- 流式识别：`pwsh -NoProfile -File .\start.ps1 -Service streaming`
- 官方文件识别自检：`pwsh -NoProfile -File .\start.ps1 -Service cli`
- 等价手动命令（离线 Web 服务，默认起点 6007，占用则顺延）：

```powershell
$env:Path = "E:\Programs\ffmpeg-master-latest-win64-gpl\bin;$env:Path"
.\.venv\Scripts\python.exe .\python-api-examples\non_streaming_server.py `
  --sense-voice E:\huggingface_cache\sherpa-onnx-sense-voice\model.int8.onnx `
  --tokens E:\huggingface_cache\sherpa-onnx-sense-voice\tokens.txt `
  --port 6007 `
  --provider cpu `
  --doc-root .\python-api-examples\web
```

本项目无 `docker-compose.yml`，`-Mode docker` 不可用。

## 验证

- CLI：`start.ps1 -Service cli` 应对 `test_wavs\zh.wav` 打出中文识别结果，退出码 0
- 本次已验证：离线服务实际端口 **6007**；`/index.html`、`/offline_record.html`、`/upload.html` 均返回 200
- 服务：浏览器打开日志里的地址
  - 离线：`/offline_record.html`、`/upload.html`
  - 流式：`/streaming_record.html`
- 健康检查：`Invoke-WebRequest http://127.0.0.1:<端口>/index.html` 返回 200

## 备注

- 端口：离线从 6007、流式从 6006 探测，占用则 +1；以启动日志为准
- 推理：`--provider cpu`（官方默认）。CUDA 轮子需要 CUDA 11.8 或 12.8+cuDNN9，本机未装 Toolkit
- 镜像源：PyPI / GitHub / huggingface.co 均可直连，未改镜像
- ffmpeg：`E:\Programs\ffmpeg-master-latest-win64-gpl\bin`
- 模型与 `.venv` 是本机材料，不要提交
- 浏览器麦克风仅 `localhost` 可用（未配 HTTPS）
- 系统 Python 是 3.14，sherpa-onnx 轮子请用 `.venv` 的 3.10
