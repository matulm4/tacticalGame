import { App } from './App.js';
import { MapStorage } from './storage/MapStorage.js';

const START_MAP = 'arena.json';

try {
  const storage = new MapStorage();
  // Pick up where the editor left off; otherwise start from the sample arena.
  const map = storage.loadAutosave() ?? (await storage.fetchSample(START_MAP));

  const app = new App({
    canvas: document.getElementById('game'),
    debugPanelElement: document.getElementById('debug-panel'),
    hudElement: document.getElementById('hud'),
    screensElement: document.getElementById('screens'),
    toolbarElement: document.getElementById('toolbar'),
    map,
    storage,
    startMode: 'play',
  });
  app.start();
  window.game = app; // for poking at the editor and simulation from the console
} catch (error) {
  document.body.textContent = `Failed to start: ${error.message}`;
  throw error;
}
