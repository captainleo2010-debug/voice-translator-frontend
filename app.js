const BACKEND_URL = 'https://voice-translator-backend-g8md.onrender.com';

const socket = io(BACKEND_URL, {
  transports: ['websocket']
});

// DOM elements
const joinBtn = document.getElementById('joinBtn');
const micBtn = document.getElementById('micBtn');
const roomInput = document.getElementById('roomId');
const myLangSelect = document.getElementById('myLang');
const partnerLangSelect = document.getElementById('partnerLang');
const logDiv = document.getElementById('log');
const audioPlayer = document.getElementById('audioPlayer');

let roomId = null;
let recognition = null;
let isRecognizing = false;

// ===== UI helpers =====
function appendLog(msg) {
  logDiv.textContent += msg + '\n';
  logDiv.scrollTop = logDiv.scrollHeight;
}

// ===== Speech setup =====
function setupSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    appendLog('Web Speech API not supported on this browser.');
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = myLangSelect.value === 'Bangla' ? 'bn-BD' : 'en-US';

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    appendLog('You said: ' + transcript);
    sendTextToBackend(transcript);
  };

  recognition.onerror = (event) => {
    appendLog('Speech recognition error: ' + event.error);
  };

  recognition.onend = () => {
    isRecognizing = false;
    micBtn.classList.remove('mic-active');
  };
}

// language change
myLangSelect.addEventListener('change', () => {
  if (recognition) {
    recognition.lang = myLangSelect.value === 'Bangla' ? 'bn-BD' : 'en-US';
  }
});

// ===== Room join =====
joinBtn.addEventListener('click', () => {
  roomId = roomInput.value.trim();
  if (!roomId) {
    alert('Enter a room ID');
    return;
  }
  socket.emit('join_room', roomId);
  appendLog('Joined room: ' + roomId);
  micBtn.disabled = false;
  setupSpeechRecognition();
});

// ===== Mic handlers =====
function startListening() {
  if (!recognition) {
    setupSpeechRecognition();
  }
  if (!recognition || isRecognizing) return;

  try {
    recognition.start();
    isRecognizing = true;
    micBtn.classList.add('mic-active');
    appendLog('Listening...');
  } catch (err) {
    console.error(err);
  }
}

function stopListening() {
  if (!recognition || !isRecognizing) return;
  recognition.stop();
}

micBtn.addEventListener('mousedown', startListening);
micBtn.addEventListener('touchstart', (e) => {
  e.preventDefault();
  startListening();
});
micBtn.addEventListener('mouseup', stopListening);
micBtn.addEventListener('mouseleave', stopListening);
micBtn.addEventListener('touchend', (e) => {
  e.preventDefault();
  stopListening();
});

// ===== Socket events =====
function sendTextToBackend(text) {
  if (!roomId) {
    appendLog('Join a room first.');
    return;
  }
  const fromLang = myLangSelect.value;
  const toLang = partnerLangSelect.value;

  socket.emit('translate_and_speak', {
    roomId,
    text,
    fromLang,
    toLang
  });
}

socket.on('play_audio', (data) => {
  const { audio, textOriginal, textTranslated, fromLang, toLang } = data;
  appendLog(`Partner (${fromLang}→${toLang}): "${textOriginal}" -> "${textTranslated}"`);

  const audioBlob = base64ToBlob(audio, 'audio/mpeg');
  const audioUrl = URL.createObjectURL(audioBlob);
  audioPlayer.src = audioUrl;
  audioPlayer.play().catch((err) => {
    console.error('Audio play error', err);
  });
});

socket.on('error_message', (msg) => {
  appendLog('Error: ' + msg);
});

socket.on('connect_error', (err) => {
  appendLog('Socket connect error: ' + err.message);
});

// helper
function base64ToBlob(base64, mime) {
  const byteChars = atob(base64);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mime });
}
