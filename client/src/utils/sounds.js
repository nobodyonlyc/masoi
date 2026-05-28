import { Howl, Howler } from 'howler';

// Global volume (0.0 - 1.0)
let masterVolume = parseFloat(localStorage.getItem('masoi_volume') ?? '0.7');
let muted = localStorage.getItem('masoi_muted') === 'true';

Howler.volume(muted ? 0 : masterVolume);

// ── Howl instances ─────────────────────────────────────────────────────────────

const BASE = '/sounds/';

function sfx(file, opts = {}) {
  return new Howl({
    src: [`${BASE}${file}`],
    volume: opts.volume ?? 0.8,
    loop: opts.loop ?? false,
    preload: opts.preload ?? true,
    html5: opts.html5 ?? false,
  });
}

// Lazy-loaded map
const _cache = {};

function get(name) {
  if (!_cache[name]) _cache[name] = createHowl(name);
  return _cache[name];
}

function createHowl(name) {
  switch (name) {
    // Ambience (looping, html5 for streaming)
    case 'night_ambience':
      return new Howl({ src: [`${BASE}night_ambience.wav`], loop: true, volume: 0.35, html5: true, preload: false });
    case 'day_ambience':
      return new Howl({ src: [`${BASE}day_ambience.wav`], loop: true, volume: 0.25, html5: true, preload: false });

    // One-shots
    case 'wolf_howl':
      return sfx('wolf_howl.wav', { volume: 0.75 });
    case 'game_start':
      return sfx('game_start.wav', { volume: 0.8 });
    case 'role_reveal':
      return sfx('role_reveal.wav', { volume: 0.7 });
    case 'death':
      return sfx('death.wav', { volume: 0.7 });
    case 'hang':
      return sfx('hang.wav', { volume: 0.75 });
    case 'vote_bell':
      return sfx('vote_bell.wav', { volume: 0.6 });
    case 'wolf_win':
      return sfx('wolf_win.wav', { volume: 0.8 });
    case 'village_win':
      return sfx('village_win.wav', { volume: 0.8 });
    case 'click':
      return sfx('click.wav', { volume: 0.5 });
    case 'chat':
      return sfx('chat.wav', { volume: 0.4 });
    case 'error':
      return sfx('error.wav', { volume: 0.6 });
    case 'tick':
      return sfx('tick.wav', { volume: 0.3 });
    case 'tick_urgent':
      return sfx('tick_urgent.wav', { volume: 0.55 });
    default:
      return null;
  }
}

// ── Active ambience tracker ─────────────────────────────────────────────────

let _ambience = null;

function stopAmbience() {
  if (_ambience) { _ambience.fade(_ambience.volume(), 0, 800); setTimeout(() => _ambience?.stop(), 850); _ambience = null; }
}

function startAmbience(name) {
  stopAmbience();
  if (muted) return;
  const h = get(name);
  if (!h) return;
  _ambience = h;
  h.volume(0);
  h.play();
  h.fade(0, name === 'night_ambience' ? 0.35 : 0.25, 1200);
}

// ── Public API ──────────────────────────────────────────────────────────────

export const sounds = {
  // UI
  click()       { play('click'); },
  chat()        { play('chat'); },
  error()       { play('error'); },
  tick()        { play('tick'); },
  tickUrgent()  { play('tick_urgent'); },

  // Game events
  gameStart()   { play('game_start'); },
  roleReveal()  { play('role_reveal'); },
  wolfHowl()    { play('wolf_howl'); },
  death()       { play('death'); },
  hang()        { play('hang'); },
  voteBell()    { play('vote_bell'); },
  wolfWin()     { play('wolf_win'); },
  villageWin()  { play('village_win'); },

  // Phase transitions
  nightFall() {
    startAmbience('night_ambience');
    setTimeout(() => play('wolf_howl'), 600);
  },
  dayBreak() {
    startAmbience('day_ambience');
  },
  votePhase() {
    stopAmbience();
    play('vote_bell');
  },

  stopAmbience,

  // Volume control
  setVolume(v) {
    masterVolume = Math.max(0, Math.min(1, v));
    localStorage.setItem('masoi_volume', masterVolume);
    if (!muted) Howler.volume(masterVolume);
  },

  toggleMute() {
    muted = !muted;
    localStorage.setItem('masoi_muted', muted);
    Howler.volume(muted ? 0 : masterVolume);
    if (muted) stopAmbience();
    return muted;
  },

  isMuted: () => muted,
  getVolume: () => masterVolume,
};

function play(name) {
  if (muted) return;
  const h = get(name);
  if (h) { h.stop(); h.play(); }
}
