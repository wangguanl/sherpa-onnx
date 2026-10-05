// This file copies and modifies code
// from https://mdn.github.io/web-dictaphone/scripts/app.js
// and https://gist.github.com/meziantou/edb7217fddfbb70e899e

var socket;

const serverIpInput = document.getElementById('server-ip');
const serverPortInput = document.getElementById('server-port');

const connectBtn = document.getElementById('connect');
const uploadBtn = document.getElementById('file');

function initWebSocket() {
  let protocol = 'ws://';
  if (window.location.protocol == 'https:') {
    protocol = 'wss://'
  }
  let server_ip = serverIpInput.value;
  let server_port = serverPortInput.value;
  console.log('protocol: ', protocol);
  console.log('server_ip: ', server_ip);
  console.log('server_port: ', server_port);

  let uri = protocol + server_ip + ':' + server_port;
  console.log('uri', uri);
  socket = new WebSocket(uri);

  // Connection opened
  socket.addEventListener('open', function(event) {
    console.log('connected');
    recordBtn.disabled = false;
    connectBtn.disabled = true;
    connectBtn.innerHTML = '已连接';
  });

  // Connection closed
  socket.addEventListener('close', function(event) {
    console.log('disconnected');
    recordBtn.disabled = true;
    stopBtn.disabled = true;
    connectBtn.disabled = false;
    connectBtn.innerHTML = '连接服务器';
  });

  // Listen for messages
  socket.addEventListener('message', function(event) {
    console.log('Received message: ', event.data);

    document.getElementById('results').value = event.data;
    socket.send('Done');
    console.log('Sent Done');
    socket.close();
  });
}

const recordBtn = document.getElementById('offline_record');
const stopBtn = document.getElementById('offline_stop');
const clearBtn = document.getElementById('clear');
const soundClips = document.getElementById('sound-clips');
const canvas = document.getElementById('canvas');
const mainSection = document.querySelector('.container');

recordBtn.disabled = true;
stopBtn.disabled = true;

window.onload = (event) => {
  console.log('page is fully loaded');
  console.log('protocol', window.location.protocol);
  console.log('port', window.location.port);
  if (window.location.protocol == 'https:') {
    document.getElementById('ws-protocol').textContent = 'wss://';
  }
  serverIpInput.value = window.location.hostname;
  serverPortInput.value = window.location.port;
};

connectBtn.onclick = function() {
  initWebSocket();
};


let audioCtx;
const canvasCtx = canvas.getContext('2d');
let mediaStream;
let analyser;
let rawStream = null;
let useSystemAudio = false;

let expectedSampleRate = 16000;
let recordSampleRate;  // the sampleRate of the microphone
let recorder = null;   // the microphone
let leftchannel = [];  // TODO: Use a single channel

let recordingLength = 0;  // number of samples so far

clearBtn.onclick = function() {
  document.getElementById('results').value = '';
};

function send_header(n) {
  const header = new ArrayBuffer(8);
  new DataView(header).setInt32(0, expectedSampleRate, true /* littleEndian */);
  new DataView(header).setInt32(4, n, true /* littleEndian */);
  socket.send(new Int32Array(header, 0, 2));
}

// copied/modified from https://mdn.github.io/web-dictaphone/
// and
// https://gist.github.com/meziantou/edb7217fddfbb70e899e
if (navigator.mediaDevices.getUserMedia) {
  console.log('getUserMedia supported.');

  let onSuccess = function(stream) {
    if (rawStream && rawStream !== stream) {
      rawStream.getTracks().forEach(function(t) { t.stop(); });
    }
    rawStream = stream;
    try { if (mediaStream) mediaStream.disconnect(); } catch (e) {}
    try { if (recorder) recorder.disconnect(); } catch (e) {}

    if (!audioCtx) {
      audioCtx = new AudioContext();
    }
    console.log(audioCtx);
    recordSampleRate = audioCtx.sampleRate;
    console.log('sample rate ' + recordSampleRate);

    // creates an audio node from the microphone incoming stream
    mediaStream = audioCtx.createMediaStreamSource(stream);
    console.log(mediaStream);

    // https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/createScriptProcessor
    // bufferSize: the onaudioprocess event is called when the buffer is full
    var bufferSize = 2048;
    var numberOfInputChannels = 2;
    var numberOfOutputChannels = 2;
    if (audioCtx.createScriptProcessor) {
      recorder = audioCtx.createScriptProcessor(
          bufferSize, numberOfInputChannels, numberOfOutputChannels);
    } else {
      recorder = audioCtx.createJavaScriptNode(
          bufferSize, numberOfInputChannels, numberOfOutputChannels);
    }
    console.log(recorder);

    recorder.onaudioprocess = function(e) {
      let samples = new Float32Array(e.inputBuffer.getChannelData(0))
      samples = downsampleBuffer(samples, expectedSampleRate);
      let buf = new Int16Array(samples.length);
      for (var i = 0; i < samples.length; ++i) {
        let s = samples[i];
        if (s >= 1)
          s = 1;
        else if (s <= -1)
          s = -1;
        buf[i] = s * 32767;
      }
      leftchannel.push(buf);
      recordingLength += bufferSize;
    };

    visualize(stream);
    mediaStream.connect(analyser);

    recordBtn.onclick = function() {
      mediaStream.connect(recorder);
      mediaStream.connect(analyser);
      // ScriptProcessor 必须接到 destination 才会回调；增益 0 避免系统声音回放啸叫
      if (!window._sherpaSilentGain) {
        window._sherpaSilentGain = audioCtx.createGain();
        window._sherpaSilentGain.gain.value = 0;
        window._sherpaSilentGain.connect(audioCtx.destination);
      }
      recorder.connect(window._sherpaSilentGain);

      console.log('recorder started');
      recordBtn.style.background = 'red';

      stopBtn.disabled = false;
      recordBtn.disabled = true;
    };

    stopBtn.onclick = function() {
      console.log('recorder stopped');

      // stopBtn recording
      recorder.disconnect(audioCtx.destination);
      mediaStream.disconnect(recorder);
      mediaStream.disconnect(analyser);

      recordBtn.style.background = '';
      recordBtn.style.color = '';
      // mediaRecorder.requestData();

      stopBtn.disabled = true;
      recordBtn.disabled = false;

      const clipName =
          prompt('给这段录音起个名字？', '未命名录音');

      const clipContainer = document.createElement('article');
      const clipLabel = document.createElement('p');
      const audio = document.createElement('audio');
      const deleteButton = document.createElement('button');
      clipContainer.classList.add('clip');
      audio.setAttribute('controls', '');
      deleteButton.textContent = '删除';
      deleteButton.className = 'delete';

      if (clipName === null) {
        clipLabel.textContent = '未命名录音';
      } else {
        clipLabel.textContent = clipName;
      }

      clipContainer.appendChild(audio);

      clipContainer.appendChild(clipLabel);
      clipContainer.appendChild(deleteButton);
      soundClips.appendChild(clipContainer);

      audio.controls = true;
      let samples = flatten(leftchannel);
      let buf = new Float32Array(samples.length);
      for (var i = 0; i < samples.length; ++i) {
        let s = samples[i];
        buf[i] = s / 32767.0;
      }
      const blob = toWav(samples);

      leftchannel = [];
      const audioURL = window.URL.createObjectURL(blob);
      audio.src = audioURL;
      console.log('recorder stopped');

      deleteButton.onclick = function(e) {
        let evtTgt = e.target;
        evtTgt.parentNode.parentNode.removeChild(evtTgt.parentNode);
      };

      clipLabel.onclick = function() {
        const existingName = clipLabel.textContent;
        const newClipName = prompt('重新命名这段录音？');
        if (newClipName === null) {
          clipLabel.textContent = existingName;
        } else {
          clipLabel.textContent = newClipName;
        }
      };

      buf = buf.buffer

      let n = 1024 * 4;  // send this number of bytes per request.
      console.log('buf length, ' + buf.byteLength);
      send_header(buf.byteLength);

      for (let start = 0; start < buf.byteLength; start += n) {
        socket.send(buf.slice(start, start + n));
      }
    };
  };

  let onError = function(err) {
    console.log('The following error occurred: ' + err);
  };

  function micConstraints() {
    const sel = document.getElementById('audio_device');
    const id = sel && sel.value;
    const audio = {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false
    };
    if (id) audio.deviceId = {exact: id};
    return {audio: audio};
  }

  function refreshDeviceList() {
    const sel = document.getElementById('audio_device');
    if (!sel || !navigator.mediaDevices.enumerateDevices) return Promise.resolve();
    return navigator.mediaDevices.enumerateDevices().then(function(devs) {
      const inputs = devs.filter(function(d) { return d.kind === 'audioinput'; });
      const prev = sel.value;
      sel.innerHTML = '';
      inputs.forEach(function(d) {
        const opt = document.createElement('option');
        opt.value = d.deviceId;
        opt.textContent = d.label || ('输入设备 ' + String(d.deviceId).slice(0, 8));
        sel.appendChild(opt);
      });
      const named = function(re) {
        return inputs.find(function(d) { return re.test(d.label || ''); });
      };
      const vm = named(/voicemeeter\s+out\s+b1\b/i)
        || named(/voicemeeter output/i)
        || named(/voicemeeter\s+out\s+b\d/i)
        || named(/voicemeeter/i);
      if (prev && inputs.some(function(d) { return d.deviceId === prev; })) {
        sel.value = prev;
      } else if (vm) {
        sel.value = vm.deviceId;
      }
    });
  }

  function requestMic() {
    useSystemAudio = false;
    navigator.mediaDevices.getUserMedia(micConstraints()).then(function(stream) {
      onSuccess(stream);
      const before = (document.getElementById('audio_device') || {}).value;
      refreshDeviceList().then(function() {
        const after = (document.getElementById('audio_device') || {}).value;
        if (after && after !== before) requestMic();
      });
    }, onError);
  }

  function requestSystemAudio() {
    if (!navigator.mediaDevices.getDisplayMedia) {
      alert('当前浏览器不支持捕获系统声音，请用 Chrome 或 Edge。');
      return;
    }
    navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: {echoCancellation: false, noiseSuppression: false, autoGainControl: false}
    }).then(function(stream) {
      stream.getVideoTracks().forEach(function(t) { t.stop(); });
      if (stream.getAudioTracks().length === 0) {
        stream.getTracks().forEach(function(t) { t.stop(); });
        alert('没有捕获到声音。请勾选「共享系统音频」，或共享一个带声音的标签页。');
        return;
      }
      useSystemAudio = true;
      onSuccess(stream);
    }).catch(onError);
  }

  const micBtn = document.getElementById('audio_mic');
  const systemBtn = document.getElementById('audio_system');
  const deviceSel = document.getElementById('audio_device');
  if (micBtn) micBtn.onclick = requestMic;
  if (systemBtn) systemBtn.onclick = requestSystemAudio;
  if (deviceSel) deviceSel.onchange = requestMic;

  requestMic();
} else {
  console.log('getUserMedia not supported on your browser!');
  alert('当前浏览器不支持麦克风录音');
}

function visualize(stream) {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }

  const source = audioCtx.createMediaStreamSource(stream);

  if (!analyser) {
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
  }
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  // source.connect(analyser);
  // analyser.connect(audioCtx.destination);

  draw()

  function draw() {
    const WIDTH = canvas.width
    const HEIGHT = canvas.height;

    requestAnimationFrame(draw);

    analyser.getByteTimeDomainData(dataArray);

    canvasCtx.fillStyle = 'rgb(200, 200, 200)';
    canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);

    canvasCtx.lineWidth = 2;
    canvasCtx.strokeStyle = 'rgb(0, 0, 0)';

    canvasCtx.beginPath();

    let sliceWidth = WIDTH * 1.0 / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      let v = dataArray[i] / 128.0;
      let y = v * HEIGHT / 2;

      if (i === 0) {
        canvasCtx.moveTo(x, y);
      } else {
        canvasCtx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    canvasCtx.lineTo(canvas.width, canvas.height / 2);
    canvasCtx.stroke();
  }
}

window.onresize = function() {
  canvas.width = mainSection.offsetWidth;
};

window.onresize();

// this function is copied/modified from
// https://gist.github.com/meziantou/edb7217fddfbb70e899e
function flatten(listOfSamples) {
  let n = 0;
  for (let i = 0; i < listOfSamples.length; ++i) {
    n += listOfSamples[i].length;
  }
  let ans = new Int16Array(n);

  let offset = 0;
  for (let i = 0; i < listOfSamples.length; ++i) {
    ans.set(listOfSamples[i], offset);
    offset += listOfSamples[i].length;
  }
  return ans;
}

// this function is copied/modified from
// https://gist.github.com/meziantou/edb7217fddfbb70e899e
function toWav(samples) {
  let buf = new ArrayBuffer(44 + samples.length * 2);
  var view = new DataView(buf);

  // http://soundfile.sapp.org/doc/WaveFormat/
  //                   F F I R
  view.setUint32(0, 0x46464952, true);               // chunkID
  view.setUint32(4, 36 + samples.length * 2, true);  // chunkSize
  //                   E V A W
  view.setUint32(8, 0x45564157, true);  // format
                                        //
  //                      t m f
  view.setUint32(12, 0x20746d66, true);          // subchunk1ID
  view.setUint32(16, 16, true);                  // subchunk1Size, 16 for PCM
  view.setUint32(20, 1, true);                   // audioFormat, 1 for PCM
  view.setUint16(22, 1, true);                   // numChannels: 1 channel
  view.setUint32(24, expectedSampleRate, true);  // sampleRate
  view.setUint32(28, expectedSampleRate * 2, true);  // byteRate
  view.setUint16(32, 2, true);                       // blockAlign
  view.setUint16(34, 16, true);                      // bitsPerSample
  view.setUint32(36, 0x61746164, true);              // Subchunk2ID
  view.setUint32(40, samples.length * 2, true);      // subchunk2Size

  let offset = 44;
  for (let i = 0; i < samples.length; ++i) {
    view.setInt16(offset, samples[i], true);
    offset += 2;
  }

  return new Blob([view], {type: 'audio/wav'});
}

// this function is copied from
// https://github.com/awslabs/aws-lex-browser-audio-capture/blob/master/lib/worker.js#L46
function downsampleBuffer(buffer, exportSampleRate) {
  if (exportSampleRate === recordSampleRate) {
    return buffer;
  }
  var sampleRateRatio = recordSampleRate / exportSampleRate;
  var newLength = Math.round(buffer.length / sampleRateRatio);
  var result = new Float32Array(newLength);
  var offsetResult = 0;
  var offsetBuffer = 0;
  while (offsetResult < result.length) {
    var nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
    var accum = 0, count = 0;
    for (var i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      accum += buffer[i];
      count++;
    }
    result[offsetResult] = accum / count;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }
  return result;
};
