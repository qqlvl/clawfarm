import { GifSource } from 'pixi.js/gif';

const agentGifUrls = Object.entries(
  import.meta.glob('./assets/character/*.gif', { query: '?url', import: 'default', eager: true })
)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, url]) => url as string);

// Cache loaded GIF sources per agent ID
const gifCache = new Map<string, GifSource>();
const loadingPromises = new Map<string, Promise<GifSource | null>>();

export function getAgentGifUrls(): string[] {
  return agentGifUrls;
}

/**
 * Load GIF for specific agent on-demand
 * Uses stable hash to pick GIF from available list
 * Caches result so same agent always gets same GIF
 */
export async function loadGifForAgent(agentId: string): Promise<GifSource | null> {
  // Check cache first
  if (gifCache.has(agentId)) {
    return gifCache.get(agentId)!;
  }

  // Check if already loading
  if (loadingPromises.has(agentId)) {
    return loadingPromises.get(agentId)!;
  }

  // Start loading with fallback retry
  const loadPromise = (async () => {
    const hash = hashString(agentId);
    const maxAttempts = 5; // Try up to 5 different GIFs

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        // Use hash + attempt offset to pick different GIF on retry
        const gifIndex = (hash + attempt) % agentGifUrls.length;
        const gifUrl = agentGifUrls[gifIndex];

        if (attempt === 0) {
          console.log(`[GIF] Loading for agent ${agentId}: ${gifUrl.split('/').pop()}`);
        } else {
          console.log(`[GIF] Retry ${attempt} for ${agentId}: ${gifUrl.split('/').pop()}`);
        }

        const response = await fetch(gifUrl);
        if (!response.ok) {
          console.warn(`[GIF] Fetch failed (${response.status}), trying next...`);
          continue; // Try next GIF
        }

        const buffer = await response.arrayBuffer();
        const src = GifSource.from(buffer, { fps: 10 });

        // Validate GIF source
        if (src && src.frames && src.frames.length > 0 && src.frames[0]) {
          gifCache.set(agentId, src);
          if (attempt > 0) {
            console.log(`[GIF] ✅ Loaded on retry ${attempt} for ${agentId}`);
          } else {
            console.log(`[GIF] ✅ Loaded successfully for ${agentId}`);
          }
          return src;
        } else {
          console.warn(`[GIF] Invalid frames, trying next GIF...`);
          continue; // Try next GIF
        }
      } catch (error) {
        console.warn(`[GIF] Load error (attempt ${attempt}):`, error);
        // Try next GIF
      }
    }

    // All attempts failed
    console.error(`[GIF] ❌ Failed all ${maxAttempts} attempts for ${agentId}`);
    loadingPromises.delete(agentId);
    return null;
  })();

  loadingPromises.set(agentId, loadPromise);
  return loadPromise;
}

/**
 * Get cached GIF source for agent (sync)
 * Returns null if not loaded yet
 */
export function getCachedGif(agentId: string): GifSource | null {
  return gifCache.get(agentId) || null;
}

/**
 * Simple string hash function (same as renderer used)
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}
