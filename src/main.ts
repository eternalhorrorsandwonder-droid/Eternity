/**
 * ETERNITY — Voxel Realms.
 *
 * Boot entry point. Creates the game shell, waits for the Web Audio context to
 * unlock on the first user gesture, and hands over to the scene. Everything
 * after this file is either the engine (engine/) or the content (game/data/).
 */

import './styles.css';
import { Game } from './game/Game';

const host = document.getElementById('app') || document.body;
const loading = document.getElementById('loading');

const setStatus = (text: string): void => {
  const node = document.getElementById('loading-sub');
  if (node) node.textContent = text;
};

const setFill = (pct: number): void => {
  const fill = document.getElementById('loading-fill');
  if (fill) fill.style.width = `${pct}%`;
};

const game = new Game({ container: host });

let started = false;
const start = async (): Promise<void> => {
  if (started) return;
  started = true;
  try {
    setStatus('Building the world…');
    setFill(55);
    await game.audio.unlock();
    await game.boot();
    setFill(100);
    setStatus('Press any key or tap to enter Eternity');
    if (loading) setTimeout(() => loading.classList.add('hidden'), 480);
  } catch (err) {
    setStatus(`Failed to start: ${(err as Error).message}`);
    if (loading) loading.classList.add('error');
    console.error(err);
  }
};

// Web Audio can only start after a gesture, so the first interaction both
// unlocks the audio context and begins the boot sequence.
const unlock = (): void => {
  void game.audio.unlock();
  window.removeEventListener('pointerdown', unlock);
  window.removeEventListener('keydown', unlock);
};
window.addEventListener('pointerdown', unlock);
window.addEventListener('keydown', unlock);
window.addEventListener('pointerdown', () => void start(), { once: true });
window.addEventListener('keydown', () => void start(), { once: true });

// Keep the canvas sized to its container and reposition the touch controls.
window.addEventListener('resize', () => game.resize(), { passive: true });
window.addEventListener('orientationchange', () => setTimeout(() => game.resize(), 260));

// Stop the page behind the game from scrolling while a finger drags across it.
document.addEventListener('touchmove', (e) => {
  const t = e.target as HTMLElement | null;
  if (t instanceof HTMLCanvasElement || t?.closest('.game-canvas-host') || t?.closest('.touch-layer')) {
    e.preventDefault();
  }
}, { passive: false });

export { game };
