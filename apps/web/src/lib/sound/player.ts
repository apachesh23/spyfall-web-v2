'use client';

import { Howl, Howler } from 'howler';
import { useSoundStore } from '@/store/sound-store';

/** Дефолт Howler — 10; при переключениях game / vote / guess пул HTML5 Audio исчерпывается → тишина и предупреждения в консоли. */
if (typeof window !== 'undefined' && typeof Howler !== 'undefined') {
  Howler.html5PoolSize = 24;
}
import {
  UI_SOUNDS,
  VFX_SOUNDS,
  MUSIC_TRACKS,
  MUSIC_PLAYLISTS,
  type UISoundId,
  type VFXSoundId,
  type MusicTrackId,
} from './definitions';

// --- КОНФИГУРАЦИЯ ---
const FADE_IN_MS = 2000;
const STORAGE_KEY = 'spyfall_music_state';

type MusicContext = 'auth' | 'lobby' | 'game' | 'vote' | 'spyGuess';

/** `/play`: MatchScreen регистрирует — первый жест не должен вслепую звать `startGameMusic` (F5 во время голосования). */
let matchMusicBootstrapHandler: (() => void) | null = null;

export function setMatchMusicBootstrapHandler(handler: (() => void) | null): void {
  matchMusicBootstrapHandler = handler;
}

/** Первый клик/тач на странице матча: resume AudioContext + правильный трек по фазе (discussion / voting / spy guess). */
export function runMatchMusicOnFirstGesture(): void {
  if (typeof window === 'undefined') return;
  if (Howler.ctx && Howler.ctx.state === 'suspended') {
    void Howler.ctx.resume();
  }
  if (matchMusicBootstrapHandler) {
    matchMusicBootstrapHandler();
    return;
  }
  startGameMusic();
}

// Тип для сохранения состояния (vote не сохраняем)
type SavedState = {
  context: 'auth' | 'lobby' | 'game';
  trackId: MusicTrackId;
  time: number; // время в секундах
  timestamp: number; // время сохранения
};

// --- HELPERS ---

function getUIVolume(): number {
  const { ui } = useSoundStore.getState();
  return ui.muted ? 0 : ui.volume;
}

function getMusicVolume(): number {
  const { music } = useSoundStore.getState();
  return music.muted ? 0 : music.volume;
}

function getVFXVolume(): number {
  const { vfx } = useSoundStore.getState();
  return vfx.muted ? 0 : vfx.volume;
}

// Кэш для коротких UI-звуков
const uiHowls: Partial<Record<UISoundId, Howl>> = {};

// Кэш для VFX-звуков
const vfxHowls: Partial<Record<VFXSoundId, Howl>> = {};

// Текущая музыка
let currentMusicHowl: Howl | null = null;
let currentMusicId: MusicTrackId | null = null;

// Глобальное состояние
let activeContext: MusicContext | null = null;
let authPlaylistIndex = 0;
let lobbyPlaylistIndex = 0;
let gamePlaylistIndex = 0;
let votePlaylistIndex = 0;

// --- STATE MANAGEMENT ---

function saveAudioState() {
  if (typeof window === 'undefined') return;
  if (
    !activeContext ||
    activeContext === 'vote' ||
    activeContext === 'spyGuess' ||
    !currentMusicHowl ||
    !currentMusicId
  )
    return;

  const seek = currentMusicHowl.seek();
  const currentTime = typeof seek === 'number' ? seek : 0;

  const state: SavedState = {
    context: activeContext,
    trackId: currentMusicId,
    time: currentTime,
    timestamp: Date.now(),
  };

  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save audio state', e);
  }
}

function getSavedStateForContext(context: 'auth' | 'lobby' | 'game'): SavedState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const state = JSON.parse(raw) as SavedState;
    if (state.context !== context) return null;
    if (Date.now() - state.timestamp > 3600 * 1000) return null;

    return state;
  } catch {
    return null;
  }
}

// --- CORE FUNCTIONS ---

function getUIHowl(id: UISoundId): Howl {
  if (!uiHowls[id]) {
    uiHowls[id] = new Howl({
      src: [UI_SOUNDS[id].src],
      volume: UI_SOUNDS[id].baseVolume,
      preload: true,
    });
  }
  return uiHowls[id]!;
}

function getVFXHowl(id: VFXSoundId): Howl {
  if (!vfxHowls[id]) {
    vfxHowls[id] = new Howl({
      src: [VFX_SOUNDS[id].src],
      volume: VFX_SOUNDS[id].baseVolume,
      preload: true,
    });
  }
  return vfxHowls[id]!;
}

/** * Проверка на iOS (iPhone, iPad, iPod). 
 * Apple блокирует volume control для html5: true, поэтому для iOS нужно html5: false.
 */
function isIOS(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Проверка User Agent и платформы (включая iPadOS, который представляется как Mac)
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

/** Создает новый инстанс музыки (без зацикливания) */
function createMusicHowl(id: MusicTrackId): Howl {
  const useHtml5 = !isIOS();

  return new Howl({
    src: [MUSIC_TRACKS[id].src],
    volume: 0,
    html5: useHtml5,
    preload: true,
    autoplay: false,
    loop: false,
  });
}

/** Для голосования: одна дорожка зациклена (vote1 или vote2) */
function createVoteHowl(id: 'vote1' | 'vote2'): Howl {
  /** Web Audio: не трогаем Html5 pool (как guess) — меньше «двойного» звука и сбоев после F5. */
  return new Howl({
    src: [MUSIC_TRACKS[id].src],
    volume: 0,
    html5: false,
    preload: true,
    autoplay: false,
    loop: true,
  });
}

function createSpyGuessHowl(): Howl {
  /** Всегда Web Audio: не занимаем Html5 pool (иначе после spy-guess / F5 «pool exhausted», музыка не стартует). */
  return new Howl({
    src: [MUSIC_TRACKS.guess.src],
    volume: 0,
    html5: false,
    preload: true,
    autoplay: false,
    loop: true,
  });
}

function unloadCurrentMusic(): void {
  if (currentMusicHowl) {
    currentMusicHowl.stop();
    currentMusicHowl.off();
    currentMusicHowl.unload();
    currentMusicHowl = null;
  }
  currentMusicId = null;
  if (activeContext === 'vote') currentVoteTrackId = null;
}

let currentVoteTrackId: 'vote1' | 'vote2' | null = null;

// --- UI API ---

export function playUI(id: UISoundId): void {
  if (typeof window === 'undefined') return;
  if (Howler.ctx && Howler.ctx.state === 'suspended') {
    Howler.ctx.resume();
  }

  const howl = getUIHowl(id);
  howl.volume(UI_SOUNDS[id].baseVolume * getUIVolume());
  howl.play();
}

/** Проиграть VFX-звук (баннеры, счётчик, победа). Учитывает громкость слоя vfx. */
export function playVFX(id: VFXSoundId): void {
  if (typeof window === 'undefined') return;
  if (Howler.ctx && Howler.ctx.state === 'suspended') {
    Howler.ctx.resume();
  }

  const howl = getVFXHowl(id);
  howl.volume(VFX_SOUNDS[id].baseVolume * getVFXVolume());
  howl.play();
}

// --- MUSIC LOGIC ---

function getPlaylistIndex(context: MusicContext): number {
  if (context === 'auth') return authPlaylistIndex;
  if (context === 'lobby') return lobbyPlaylistIndex;
  if (context === 'game') return gamePlaylistIndex;
  if (context === 'vote') return votePlaylistIndex;
  return 0;
}

function setPlaylistIndex(context: MusicContext, index: number) {
  if (context === 'auth') authPlaylistIndex = index;
  else if (context === 'lobby') lobbyPlaylistIndex = index;
  else if (context === 'game') gamePlaylistIndex = index;
  else if (context === 'vote') votePlaylistIndex = index;
}

function playNextTrackInContext(
  context: MusicContext,
  playlist: readonly MusicTrackId[],
  index: number,
  seekTo: number = 0
) {
  if (activeContext !== context) return;

  unloadCurrentMusic();

  const trackId = playlist[index];
  const def = MUSIC_TRACKS[trackId];
  const targetVol = def.baseVolume * getMusicVolume();

  const howl = createMusicHowl(trackId);
  currentMusicHowl = howl;
  currentMusicId = trackId;

  howl.volume(0);
  howl.play();

  if (seekTo > 0) {
    howl.seek(seekTo);
    howl.fade(0, targetVol, 500);
  } else {
    howl.fade(0, targetVol, FADE_IN_MS);
  }

  howl.once('end', () => {
    if (activeContext !== context) return;

    const nextIndex = (getPlaylistIndex(context) + 1) % playlist.length;
    setPlaylistIndex(context, nextIndex);
    playNextTrackInContext(context as MusicContext, playlist, nextIndex, 0);
  });
}

// --- EXPORTED MUSIC API ---

export function startAuthMusic(): void {
  if (typeof window === 'undefined') return;
  if (activeContext === 'lobby' || activeContext === 'auth') return;

  activeContext = 'auth';
  
  const saved = getSavedStateForContext('auth');
  if (saved) {
    // FIX TYPESCRIPT ERROR: Приводим плейлист к общему типу MusicTrackId[], чтобы indexOf принял аргумент
    const savedIndex = (MUSIC_PLAYLISTS.auth as readonly MusicTrackId[]).indexOf(saved.trackId);
    if (savedIndex !== -1) {
      authPlaylistIndex = savedIndex;
      playNextTrackInContext('auth', MUSIC_PLAYLISTS.auth, authPlaylistIndex, saved.time);
      return;
    }
  }

  authPlaylistIndex = 0;
  playNextTrackInContext('auth', MUSIC_PLAYLISTS.auth, authPlaylistIndex, 0);
}

export function stopAuthMusic(): void {
  if (activeContext === 'auth') {
    saveAudioState();
    activeContext = null;
    unloadCurrentMusic();
  }
}

export function startLobbyMusic(): void {
  if (typeof window === 'undefined') return;
  if (activeContext === 'lobby') return;

  activeContext = 'lobby';

  const saved = getSavedStateForContext('lobby');
  if (saved) {
    const savedIndex = (MUSIC_PLAYLISTS.lobby as readonly MusicTrackId[]).indexOf(saved.trackId);
    if (savedIndex !== -1) {
      lobbyPlaylistIndex = savedIndex;
      playNextTrackInContext('lobby', MUSIC_PLAYLISTS.lobby, lobbyPlaylistIndex, saved.time);
      return;
    }
  }

  lobbyPlaylistIndex = 0;
  playNextTrackInContext('lobby', MUSIC_PLAYLISTS.lobby, lobbyPlaylistIndex, 0);
}

export function stopLobbyMusic(shouldSave = true): void {
  if (activeContext === 'lobby') {
    if (shouldSave) saveAudioState();
    activeContext = null;
    unloadCurrentMusic();
  }
}

export function startGameMusic(): void {
  if (typeof window === 'undefined') return;
  if (Howler.ctx && Howler.ctx.state === 'suspended') {
    void Howler.ctx.resume();
  }
  if (activeContext === 'game') return;
  /** Не перебивать vote1/vote2 жестом с `MatchPlayMusicMount` до выхода из голосования. */
  if (activeContext === 'vote') return;
  if (activeContext === 'spyGuess') return;

  activeContext = 'game';

  const saved = getSavedStateForContext('game');
  if (saved) {
    const savedIndex = (MUSIC_PLAYLISTS.game as readonly MusicTrackId[]).indexOf(saved.trackId);
    if (savedIndex !== -1) {
      gamePlaylistIndex = savedIndex;
      playNextTrackInContext('game', MUSIC_PLAYLISTS.game, gamePlaylistIndex, saved.time);
      return;
    }
  }

  gamePlaylistIndex = 0;
  playNextTrackInContext('game', MUSIC_PLAYLISTS.game, gamePlaylistIndex, 0);
}

export function stopGameMusic(shouldSave = true): void {
  if (activeContext === 'game') {
    if (shouldSave) saveAudioState();
    activeContext = null;
    unloadCurrentMusic();
  }
}

/** Музыка голосования: одна песня на первое голосование (vote1, с микро-этапами), вторая на повторное (vote2). Дорожка зациклена. */
export function startVoteMusic(round: 'first' | 'revote'): void {
  if (typeof window === 'undefined') return;
  if (Howler.ctx && Howler.ctx.state === 'suspended') {
    void Howler.ctx.resume();
  }

  const wantTrack = round === 'first' ? 'vote1' : 'vote2';
  if (activeContext === 'vote' && currentVoteTrackId === wantTrack && currentMusicHowl) {
    const st = currentMusicHowl.state();
    if (st === 'loading') return;
    if (currentMusicHowl.playing()) return;
  }

  if (activeContext === 'spyGuess') stopSpyGuessMusic();
  if (activeContext === 'game') stopGameMusic(false);
  activeContext = 'vote';

  unloadCurrentMusic();
  currentVoteTrackId = wantTrack;

  const def = MUSIC_TRACKS[wantTrack];
  const targetVol = def.baseVolume * getMusicVolume();
  const howl = createVoteHowl(wantTrack);
  currentMusicHowl = howl;
  currentMusicId = wantTrack;

  howl.volume(0);
  howl.play();
  howl.fade(0, targetVol, FADE_IN_MS);
}

/** Остановить музыку голосования (по окончании всего процесса голосования). */
export function stopVoteMusic(): void {
  if (activeContext === 'vote') {
    activeContext = null;
    currentVoteTrackId = null;
    unloadCurrentMusic();
  }
}

/** Музыка фазы угадывания шпиона (Emergency + голосование / авто-победа). */
export function startSpyGuessMusic(): void {
  if (typeof window === 'undefined') return;
  if (Howler.ctx && Howler.ctx.state === 'suspended') {
    void Howler.ctx.resume();
  }
  if (activeContext === 'spyGuess' && currentMusicId === 'guess' && currentMusicHowl) {
    const st = currentMusicHowl.state();
    if (st === 'loading') return;
    if (currentMusicHowl.playing()) return;
  }
  if (activeContext === 'game') stopGameMusic(false);
  if (activeContext === 'vote') stopVoteMusic();

  activeContext = 'spyGuess';
  unloadCurrentMusic();

  const def = MUSIC_TRACKS.guess;
  const targetVol = def.baseVolume * getMusicVolume();
  const howl = createSpyGuessHowl();
  currentMusicHowl = howl;
  currentMusicId = 'guess';

  howl.volume(0);
  howl.play();
  howl.fade(0, targetVol, FADE_IN_MS);
}

export function stopSpyGuessMusic(): void {
  if (activeContext === 'spyGuess') {
    activeContext = null;
    unloadCurrentMusic();
  }
}

// --- DEBUG / CONTROLS ---

function getPlaylistForContext(ctx: MusicContext): readonly MusicTrackId[] {
  if (ctx === 'auth') return MUSIC_PLAYLISTS.auth;
  if (ctx === 'lobby') return MUSIC_PLAYLISTS.lobby;
  if (ctx === 'game') return MUSIC_PLAYLISTS.game;
  if (ctx === 'vote') return MUSIC_PLAYLISTS.vote;
  if (ctx === 'spyGuess') return ['guess'] as const;
  return MUSIC_PLAYLISTS.game;
}

function skipTrack(direction: 'next' | 'prev') {
  if (!activeContext) return;
  if (activeContext === 'spyGuess') return;

  const playlist = getPlaylistForContext(activeContext);
  let index = getPlaylistIndex(activeContext);

  if (direction === 'next') {
    index = (index + 1) % playlist.length;
  } else {
    index = (index - 1 + playlist.length) % playlist.length;
  }

  setPlaylistIndex(activeContext, index);
  playNextTrackInContext(activeContext, playlist, index, 0);
}

export function skipAuthNext() { if (activeContext === 'auth') skipTrack('next'); }
export function skipAuthPrev() { if (activeContext === 'auth') skipTrack('prev'); }
export function skipLobbyNext() { if (activeContext === 'lobby') skipTrack('next'); }
export function skipLobbyPrev() { if (activeContext === 'lobby') skipTrack('prev'); }
export function skipGameNext() { if (activeContext === 'game') skipTrack('next'); }
export function skipGamePrev() { if (activeContext === 'game') skipTrack('prev'); }

export function syncMusicVolume(): void {
  if (typeof window === 'undefined') return;

  if (Howler.ctx && Howler.ctx.state === 'suspended') {
    Howler.ctx.resume();
  }

  const userVol = getMusicVolume();

  if (currentMusicHowl && currentMusicId) {
    const base = MUSIC_TRACKS[currentMusicId].baseVolume;
    
    if (currentMusicHowl.playing()) {
      currentMusicHowl.volume(base * userVol);
    } 
    else if (currentMusicHowl.state() === 'loaded') {
       currentMusicHowl.play();
       currentMusicHowl.fade(0, base * userVol, 500);
    }
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    saveAudioState();
  });
}