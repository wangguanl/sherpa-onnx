# ==========================================================
# 启动 离线(Non-Streaming) 语音识别 Web 服务
# 页面: http://localhost:6007
#   - Offline-Record : 录音后整体识别
#   - Upload         : 上传音频文件识别
# 模型: sherpa-onnx-sense-voice (int8)
# ==========================================================

# --- 合并 PATH (Trae 代理终端常精简 PATH) ---
$machine = [Environment]::GetEnvironmentVariable("PATH", "Machine")
$user = [Environment]::GetEnvironmentVariable("PATH", "User")
$extra = @(
  "$env:USERPROFILE\miniconda3",
  "$env:USERPROFILE\miniconda3\Scripts",
  "$env:USERPROFILE\miniconda3\condabin",
  "$env:USERPROFILE\.local\bin",
  "E:\Program Files\Git\cmd",
  "E:\Program Files\nodejs",
  "E:\Programs\ffmpeg-master-latest-win64-gpl\bin",
  "C:\Windows\System32"
) -join ";"
$env:PATH = ($machine, $user, $extra, $env:PATH) -join ";"

# --- 固定路径 ---
$ProjectRoot = "E:\Pro2\sherpa-onnx"
$Python      = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
$Script      = Join-Path $ProjectRoot "python-api-examples\non_streaming_server.py"
$ModelDir    = "E:\huggingface_cache\sherpa-onnx-sense-voice"
$WebRoot     = Join-Path $ProjectRoot "python-api-examples\web"

$Port    = 6007
$Provider = "cpu"

Write-Host "Starting non-streaming ASR server on port $Port ..." -ForegroundColor Green
& $Python $Script `
  --sense-voice (Join-Path $ModelDir "model.int8.onnx") `
  --tokens      (Join-Path $ModelDir "tokens.txt") `
  --port        $Port `
  --provider    $Provider `
  --doc-root    $WebRoot