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

  // Start loading
  const loadPromise = (async () => {
    try {
      // Use hash to pick consistent GIF for this agent
      const hash = hashString(agentId);
      const gifIndex = hash % agentGifUrls.length;
      const gifUrl = agentGifUrls[gifIndex];

      console.log(`[GIF] Loading for agent ${agentId}: ${gifUrl.split('/').pop()}`);

      const response = await fetch(gifUrl);
      const buffer = await response.arrayBuffer();
      const src = GifSource.from(buffer, { fps: 10 });

      // Validate GIF source
      if (src && src.frames && src.frames.length > 0 && src.frames[0]) {
        gifCache.set(agentId, src);
        console.log(`[GIF] Loaded successfully for ${agentId}`);
        return src;
      } else {
        console.warn(`[GIF] Invalid GIF for ${agentId}, frames missing`);
        return null;
      }
    } catch (error) {
      console.error(`[GIF] Failed to load for ${agentId}:`, error);
      return null;
    } finally {
      loadingPromises.delete(agentId);
    }
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
