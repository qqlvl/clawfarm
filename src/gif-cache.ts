import { GifSource } from 'pixi.js/gif';

const agentGifUrls = Object.entries(
  import.meta.glob('./assets/character/*.gif', { query: '?url', import: 'default', eager: true })
)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, url]) => url as string);

let cached: GifSource[] = [];
let loading: Promise<GifSource[]> | null = null;
let backgroundLoading = false;

export function getAgentGifUrls(): string[] {
  return agentGifUrls;
}

// Progressive loading: load 15 GIF immediately, rest in background
const INITIAL_GIFS = 15;  // Enough for 8 agents + buffer
export const MAX_GIFS_TO_LOAD = 100;  // Exported for stable hash calculation

async function loadGifBatch(urls: string[]): Promise<GifSource[]> {
  // Load in parallel for speed
  const promises = urls.map(async url => {
    try {
      const response = await fetch(url);
      const buffer = await response.arrayBuffer();
      const src = GifSource.from(buffer, { fps: 10 });

      if (src && src.frames && src.frames.length > 0 && src.frames[0]) {
        return src;
      }
    } catch {
      // skip failed avatar
    }
    return null;
  });

  const results = await Promise.all(promises);
  return results.filter((src): src is GifSource => src !== null);
}

export async function getAgentGifSources(): Promise<GifSource[]> {
  if (cached.length > 0) return cached;
  if (loading) return loading;

  loading = (async () => {
    // Load first batch immediately (parallel for speed)
    const initialUrls = agentGifUrls.slice(0, INITIAL_GIFS);
    const initialSources = await loadGifBatch(initialUrls);
    cached = initialSources;
    console.log(`[GIF Cache] Loaded ${initialSources.length} initial GIF sources (fast start)`);

    // Continue loading rest in background (don't await)
    if (!backgroundLoading && agentGifUrls.length > INITIAL_GIFS) {
      backgroundLoading = true;
      const remainingUrls = agentGifUrls.slice(INITIAL_GIFS, MAX_GIFS_TO_LOAD);

      loadGifBatch(remainingUrls).then(moreSources => {
        cached = [...cached, ...moreSources];
        console.log(`[GIF Cache] Background loaded ${moreSources.length} more GIF sources (total: ${cached.length})`);
      });
    }

    return cached;
  })();

  return loading;
}
