let audioCtx;
let masterGain;
let sfxGain;
let musicGain;

let settingsRef;
const buffers = {};

export function initAudio(settings) {
  settingsRef = settings;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  
  masterGain = audioCtx.createGain();
  masterGain.connect(audioCtx.destination);

  sfxGain = audioCtx.createGain();
  sfxGain.connect(masterGain);
  sfxGain.gain.value = settings.sfx ? 1 : 0;
  
  musicGain = audioCtx.createGain();
  musicGain.connect(masterGain);
  musicGain.gain.value = settings.music ? 1 : 0;

  loadSounds();
  
  // Update gains when settings change
  document.getElementById('sfxToggle').addEventListener('change', (e) => {
    sfxGain.gain.setValueAtTime(e.target.checked ? 1 : 0, audioCtx.currentTime);
  });
  document.getElementById('musicToggle').addEventListener('change', (e) => {
    musicGain.gain.setValueAtTime(e.target.checked ? 1 : 0, audioCtx.currentTime);
  });
}

async function loadSounds() {
  const soundList = {
    click: '/click.mp3',
    drawer_open: '/drawer_open.mp3',
    drawer_close: '/drawer_close.mp3',
  };

  for (const [name, url] of Object.entries(soundList)) {
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      buffers[name] = await audioCtx.decodeAudioData(arrayBuffer);
    } catch (error) {
      console.error(`Failed to load sound: ${name}`, error);
    }
  }
}

export function playSound(name) {
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  
  if (buffers[name] && settingsRef?.sfx) {
    const source = audioCtx.createBufferSource();
    source.buffer = buffers[name];
    source.connect(sfxGain);
    source.start(0);
  }
}