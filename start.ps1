#Requires -Version 5.0
<#
.SYNOPSIS
    启动 sherpa-onnx（由 wanggang-run-oss 生成）。实际逻辑按 PowerShell 7 执行。
.PARAMETER Mode
    direct = 本机直接运行；docker = 本项目无 compose，会直接报错。
.PARAMETER Port
    搜索起点；占用则 +1 顺延。未指定则：offline=6007，streaming=6006。
.PARAMETER Service
    offline = SenseVoice 离线 Web；streaming = 流式 Web；cli = 官方样例 wav 识别。
#>
[CmdletBinding()]
param(
    [ValidateSet('direct', 'docker')]
    [string]$Mode = 'direct',

    [int]$Port = 0,

    [ValidateSet('offline', 'streaming', 'cli')]
    [string]$Service = 'offline'
)

$ErrorActionPreference = 'Stop'

if ($PSVersionTable.PSVersion.Major -lt 7) {
    $pwsh = Get-Command pwsh -ErrorAction SilentlyContinue
    if (-not $pwsh) {
        throw '未找到 PowerShell 7 (pwsh)。请先全局安装：winget install --id Microsoft.PowerShell -e'
    }
    $argList = @('-NoProfile', '-File', $PSCommandPath)
    foreach ($key in $PSBoundParameters.Keys) {
        $argList += "-$key"
        $val = $PSBoundParameters[$key]
        if ($val -isnot [System.Management.Automation.SwitchParameter]) {
            $argList += [string]$val
        }
    }
    & $pwsh.Source @argList
    exit $LASTEXITCODE
}

Set-Location $PSScriptRoot
$env:PYTHONIOENCODING = 'utf-8'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()

$FfmpegBin = 'E:\Programs\ffmpeg-master-latest-win64-gpl\bin'
if (Test-Path $FfmpegBin) {
    $env:Path = "$FfmpegBin;$env:Path"
} else {
    Write-Warning "未找到本机 ffmpeg：$FfmpegBin"
}

function Show-GpuStatus {
    $smi = Get-Command nvidia-smi -ErrorAction SilentlyContinue
    if (-not $smi) {
        Write-Warning '未检测到 nvidia-smi，跳过 GPU 检查。'
        return
    }
    Write-Host '=== GPU 状态 ===' -ForegroundColor Cyan
    & nvidia-smi --query-gpu=name,memory.total,memory.used,memory.free,utilization.gpu --format=csv
}

function Test-PortBusy {
    param([int]$TargetPort)
    $listener = $null
    try {
        $listener = New-Object System.Net.Sockets.TcpListener ([System.Net.IPAddress]::Loopback, $TargetPort)
        $listener.Start()
        return $false
    } catch {
        return $true
    } finally {
        if ($null -ne $listener) { $listener.Stop() }
    }
}

function Get-FreePort {
    param(
        [int]$StartPort,
        [int]$MaxTries = 50
    )
    if ($StartPort -lt 1) { $StartPort = 1024 }
    $end = $StartPort + $MaxTries - 1
    if ($end -gt 65535) { $end = 65535 }
    $p = $StartPort
    while ($p -le $end) {
        if (-not (Test-PortBusy -TargetPort $p)) {
            if ($p -ne $StartPort) {
                Write-Host "端口 $StartPort 已占用，顺延到 $p" -ForegroundColor Yellow
            }
            return $p
        }
        $p++
    }
    throw "从 $StartPort 起连续探测均被占用，放弃。"
}

Show-GpuStatus

$Python = Join-Path $PSScriptRoot '.venv\Scripts\python.exe'
if (-not (Test-Path $Python)) {
    throw "未找到虚拟环境：$Python。请先按 RUN.md 用 uv 创建 .venv 并安装 sherpa-onnx。"
}

$SenseDir = 'E:\huggingface_cache\sherpa-onnx-sense-voice'
$StreamDir = 'E:\huggingface_cache\sherpa-onnx-streaming-zh-en'
$WebRoot = Join-Path $PSScriptRoot 'python-api-examples\web'
$Provider = 'cpu'

if ($Mode -eq 'docker') {
    throw '本项目无 docker-compose.yml，官方推荐 pip/uv 直接运行，请使用 -Mode direct。'
}

if ($Service -eq 'cli') {
    $model = Join-Path $SenseDir 'model.int8.onnx'
    $tokens = Join-Path $SenseDir 'tokens.txt'
    $wav = Join-Path $SenseDir 'test_wavs\zh.wav'
    foreach ($f in @($model, $tokens, $wav)) {
        if (-not (Test-Path $f)) { throw "缺少模型或样例音频：$f" }
    }
    Write-Host '运行官方 SenseVoice 文件识别样例...' -ForegroundColor Cyan
    $code = @'
from pathlib import Path
import sherpa_onnx
import soundfile as sf

model = r"""MODEL"""
tokens = r"""TOKENS"""
wave_filename = r"""WAV"""
recognizer = sherpa_onnx.OfflineRecognizer.from_sense_voice(
    model=model, tokens=tokens, use_itn=True, debug=False
)
audio, sample_rate = sf.read(wave_filename, dtype="float32", always_2d=True)
audio = audio[:, 0]
stream = recognizer.create_stream()
stream.accept_waveform(sample_rate, audio)
recognizer.decode_stream(stream)
print(wave_filename)
print(stream.result)
'@
    $code = $code.Replace('MODEL', $model).Replace('TOKENS', $tokens).Replace('WAV', $wav)
    & $Python -c $code
    if ($LASTEXITCODE -ne 0) { throw "CLI 识别失败，退出码 $LASTEXITCODE" }
    Write-Host 'CLI 识别完成。' -ForegroundColor Green
    return
}

if ($Service -eq 'streaming') {
    $PreferredPort = 6006
    $script = Join-Path $PSScriptRoot 'python-api-examples\streaming_server.py'
    $encoder = Join-Path $StreamDir 'encoder-epoch-99-avg-1.int8.onnx'
    $decoder = Join-Path $StreamDir 'decoder-epoch-99-avg-1.int8.onnx'
    $joiner = Join-Path $StreamDir 'joiner-epoch-99-avg-1.int8.onnx'
    $tokens = Join-Path $StreamDir 'tokens.txt'
    foreach ($f in @($script, $encoder, $decoder, $joiner, $tokens, $WebRoot)) {
        if (-not (Test-Path $f)) { throw "缺少文件：$f" }
    }
    if ($Port -gt 0) { $PreferredPort = $Port }
    $Port = Get-FreePort -StartPort $PreferredPort
    Write-Host "使用端口 $Port （流式识别）" -ForegroundColor Cyan
    Write-Host "页面 http://127.0.0.1:${Port}/streaming_record.html" -ForegroundColor Green
    & $Python $script `
        --tokens $tokens `
        --encoder $encoder `
        --decoder $decoder `
        --joiner $joiner `
        --port $Port `
        --provider $Provider `
        --doc-root $WebRoot
    exit $LASTEXITCODE
}

$PreferredPort = 6007
$script = Join-Path $PSScriptRoot 'python-api-examples\non_streaming_server.py'
$model = Join-Path $SenseDir 'model.int8.onnx'
$tokens = Join-Path $SenseDir 'tokens.txt'
foreach ($f in @($script, $model, $tokens, $WebRoot)) {
    if (-not (Test-Path $f)) { throw "缺少文件：$f" }
}
if ($Port -gt 0) { $PreferredPort = $Port }
$Port = Get-FreePort -StartPort $PreferredPort
Write-Host "使用端口 $Port （离线识别）" -ForegroundColor Cyan
Write-Host "页面 http://127.0.0.1:${Port}/offline_record.html  http://127.0.0.1:${Port}/upload.html" -ForegroundColor Green
& $Python $script `
    --sense-voice $model `
    --tokens $tokens `
    --port $Port `
    --provider $Provider `
    --doc-root $WebRoot
exit $LASTEXITCODE
