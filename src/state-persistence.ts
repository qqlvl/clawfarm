import { SimState } from './engine/types';

const STORAGE_KEY = 'growclaw_state';
const STORAGE_VERSION = 1;

interface StoredData {
  version: number;
  timestamp: number;
  state: SimState;
}

/**
 * Save current simulation state to localStorage
 */
export function saveState(state: SimState): boolean {
  try {
    const data: StoredData = {
      version: STORAGE_VERSION,
      timestamp: Date.now(),
      state
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    console.log(`[Persistence] Saved state at tick ${state.tick}`);
    return true;
  } catch (error) {
    console.error('[Persistence] Failed to save state:', error);
    return false;
  }
}

/**
 * Load simulation state from localStorage
 * Returns null if no saved state exists or if data is invalid
 */
export function loadState(): SimState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      console.log('[Persistence] No saved state found');
      return null;
    }

    const data: StoredData = JSON.parse(raw);

    // Version check
    if (data.version !== STORAGE_VERSION) {
      console.warn('[Persistence] Version mismatch, clearing old state');
      clearState();
      return null;
    }

    const age = Date.now() - data.timestamp;
    const ageMinutes = Math.floor(age / 60000);
    console.log(`[Persistence] Loaded state from ${ageMinutes} minutes ago (tick ${data.state.tick})`);

    return data.state;
  } catch (error) {
    console.error('[Persistence] Failed to load state:', error);
    return null;
  }
}

/**
 * Clear saved state from localStorage
 */
export function clearState(): void {
  localStorage.removeItem(STORAGE_KEY);
  console.log('[Persistence] Cleared saved state');
}

/**
 * Check if saved state exists
 */
export function hasSavedState(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== null;
}
