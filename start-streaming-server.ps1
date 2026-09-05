# ==========================================================
# 启动 流式(Streaming) 语音识别 Web 服务
# 页面: http://localhost:6006  (Streaming-Record)
# 模型: sherpa-onnx-streaming-zh-en (int8)
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
$Script      = Join-Path $ProjectRoot "python-api-examples\streaming_server.py"
$ModelDir    = "E:\huggingface_cache\sherpa-onnx-streaming-zh-en"
$WebRoot     = Join-Path $ProjectRoot "python-api-examples\web"

$Port    = 6006
$Provider = "cpu"

Write-Host "Starting streaming ASR server on port $Port ..." -ForegroundColor Green
& $Python $Script `
  --tokens  (Join-Path $ModelDir "tokens.txt") `
  --encoder (Join-Path $ModelDir "encoder-epoch-99-avg-1.int8.onnx") `
  --decoder (Join-Path $ModelDir "decoder-epoch-99-avg-1.int8.onnx") `
  --joiner  (Join-Path $ModelDir "joiner-epoch-99-avg-1.int8.onnx") `
  --port      $Port `
  --provider  $Provider `
  --doc-root  $WebRoot