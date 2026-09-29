/**
 * Pi AI Dubbing - Offscreen Audio Processor
 * Captures tab audio via chrome.tabCapture streamId, routes original audio to speakers (or mutes),
 * and feeds audio chunks + real-time SpeechRecognition to the dubbing pipeline.
 */

let audioContext = null;
let mediaStream = null;
let gainNode = null;
let mediaRecorder = null;
let speechRecognizer = null;
let segmentIndex = 0;
let isRecording = false;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target !== 'offscreen') return false;

  switch (message.type) {
    case 'START_RECORDING':
      startCapture(message.streamId, message.muteOriginal, message.chunkIntervalMs || 1200)
        .then(() => sendResponse({ success: true }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;

    case 'STOP_RECORDING':
      stopCapture();
      sendResponse({ success: true });
      return true;

    case 'SET_MUTE_ORIGINAL':
      if (gainNode) {
        gainNode.gain.value = message.muteOriginal ? 0 : 1;
      }
      sendResponse({ success: true, muted: message.muteOriginal });
      return true;

    case 'PING':
      sendResponse({ pong: true, isRecording, hasAudioContext: !!audioContext });
      return true;
  }
});

async function startCapture(streamId, muteOriginal = false, chunkIntervalMs = 1200) {
  if (isRecording) {
    stopCapture();
  }

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: streamId
        }
      },
      video: false
    });

    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const sourceNode = audioContext.createMediaStreamSource(mediaStream);
    gainNode = audioContext.createGain();
    gainNode.gain.value = muteOriginal ? 0 : 1;

    // Connect source -> gain -> destination so original tab audio can still be heard by user
    sourceNode.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Initialize MediaRecorder for low-latency audio chunks
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';

    mediaRecorder = new MediaRecorder(mediaStream, { mimeType, audioBitsPerSecond: 64000 });

    let chunkStartTime = Date.now();

    mediaRecorder.ondataavailable = async (e) => {
      if (e.data && e.data.size > 200) {
        segmentIndex++;
        const currentSeg = segmentIndex;
        const now = Date.now();
        const durationSec = Math.round((now - chunkStartTime) / 100) / 10;
        chunkStartTime = now;

        // Convert Blob to base64 data URL
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Data = reader.result;
          chrome.runtime.sendMessage({
            type: 'AUDIO_CHUNK_CAPTURED',
            segmentId: `seg_${currentSeg}`,
            dataUrl: base64Data,
            mimeType,
            duration: durationSec,
            timestamp: now
          });
        };
        reader.readAsDataURL(e.data);
      }
    };

    mediaRecorder.start(chunkIntervalMs);
    isRecording = true;

    // Parallel Speech Recognition in Chrome Offscreen for instant low-latency speech detection
    startSpeechRecognition();

    chrome.runtime.sendMessage({
      type: 'CAPTURE_STATUS_CHANGED',
      active: true,
      muted: muteOriginal
    });

  } catch (err) {
    console.error('Failed to capture tab audio in offscreen:', err);
    throw err;
  }
}

function startSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return;

  try {
    speechRecognizer = new SpeechRecognition();
    speechRecognizer.continuous = true;
    speechRecognizer.interimResults = false;
    speechRecognizer.lang = 'en-US'; // Standard source audio language

    speechRecognizer.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          const transcript = event.results[i][0].transcript.trim();
          if (transcript.length > 1) {
            chrome.runtime.sendMessage({
              type: 'STT_SEGMENT_DETECTED',
              segmentId: `speech_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              sourceText: transcript,
              confidence: event.results[i][0].confidence || 0.95,
              timestamp: Date.now()
            });
          }
        }
      }
    };

    speechRecognizer.onerror = (e) => {
      // Ignore routine pauses or no-speech events
      if (e.error !== 'no-speech' && e.error !== 'aborted') {
        console.warn('SpeechRecognition notice:', e.error);
      }
    };

    speechRecognizer.onend = () => {
      if (isRecording && speechRecognizer) {
        try { speechRecognizer.start(); } catch {}
      }
    };

    speechRecognizer.start();
  } catch (e) {
    console.warn('SpeechRecognition init notice:', e);
  }
}

function stopCapture() {
  isRecording = false;

  if (speechRecognizer) {
    try { speechRecognizer.stop(); } catch {}
    speechRecognizer = null;
  }

  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    try { mediaRecorder.stop(); } catch {}
    mediaRecorder = null;
  }

  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
  }

  if (audioContext && audioContext.state !== 'closed') {
    try { audioContext.close(); } catch {}
    audioContext = null;
  }

  chrome.runtime.sendMessage({
    type: 'CAPTURE_STATUS_CHANGED',
    active: false,
    muted: false
  });
}
