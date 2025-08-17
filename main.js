import { initCharacterStage, setRendererQuality } from './character.js';

const els = {
  pfpBtn: document.getElementById('pfpBtn'),
  pfpImg: document.getElementById('pfpImg'),
  pfpUsername: document.getElementById('pfpUsername'),
  pfpSub: document.getElementById('pfpSub'),
  settingsBtn: document.getElementById('settingsBtn'),
  drawer: document.getElementById('drawer'),
  drawerClose: document.getElementById('drawerClose'),
  scrim: document.getElementById('scrim'),
  playBtn: document.getElementById('playBtn'),
  musicToggle: document.getElementById('musicToggle'),
  sfxToggle: document.getElementById('sfxToggle'),
  qualityTabs: document.querySelectorAll('.segmented [role="tab"]'),
};

const SETTINGS_KEY = 'jumpguys.settings';
const defaultSettings = { music: true, sfx: true, quality: 'medium' };
let settings = loadSettings();

applySettingsUI(settings);
const stage = initCharacterStage(document.getElementById('stageCanvas'), settings.quality);

// Load user info if available
(async function loadUser() {
  try {
    const user = (window.websim && await window.websim.getUser?.()) || null;
    const username = user?.username || 'guest';
    els.pfpUsername.textContent = `@${username}`;
    const avatar = user ? `https://images.websim.com/avatar/${username}` : 'https://images.websim.com/avatar/guest';
    els.pfpImg.src = avatar;
    els.pfpImg.referrerPolicy = 'no-referrer';
    // simple fake metadata for now
    const level = 1 + Math.floor((user?.id?.charCodeAt(0) || 5) % 20);
    const crowns = (user ? (user.id.charCodeAt(1) % 3) : 0) || 0;
    els.pfpSub.textContent = `Lvl ${level} • ${crowns} crown${crowns === 1 ? '' : 's'}`;
    els.pfpBtn.onclick = () => {
      const link = user ? `https://websim.com/@${username}` : '#';
      if (user) window.open(link, '_blank');
    };
  } catch {
    // fallback already set
  }
})();

// Drawer logic
function openDrawer() {
  els.drawer.classList.add('open');
  els.scrim.classList.add('open');
  els.drawer.setAttribute('aria-hidden', 'false');
  els.scrim.setAttribute('aria-hidden', 'false');
}
function closeDrawer() {
  els.drawer.classList.remove('open');
  els.scrim.classList.remove('open');
  els.drawer.setAttribute('aria-hidden', 'true');
  els.scrim.setAttribute('aria-hidden', 'true');
}
els.settingsBtn.addEventListener('click', openDrawer);
els.drawerClose.addEventListener('click', closeDrawer);
els.scrim.addEventListener('click', closeDrawer);

// Settings handlers
els.musicToggle.addEventListener('change', () => {
  settings.music = els.musicToggle.checked;
  persistSettings();
});
els.sfxToggle.addEventListener('change', () => {
  settings.sfx = els.sfxToggle.checked;
  persistSettings();
});
els.qualityTabs.forEach(btn => {
  btn.addEventListener('click', () => {
    els.qualityTabs.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    settings.quality = btn.dataset.q;
    persistSettings();
    setRendererQuality(settings.quality);
  });
});

// Play
els.playBtn.addEventListener('click', () => {
  // Placeholder action
  els.playBtn.style.opacity = '0.8';
  setTimeout(() => (els.playBtn.style.opacity = '1'), 160);
  alert('Matchmaking coming soon!');
});

// Settings persistence
function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...defaultSettings, ...JSON.parse(raw) } : { ...defaultSettings };
  } catch {
    return { ...defaultSettings };
  }
}
function persistSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
function applySettingsUI(s) {
  els.musicToggle.checked = s.music;
  els.sfxToggle.checked = s.sfx;
  els.qualityTabs.forEach(b => b.classList.toggle('active', b.dataset.q === s.quality));
}

