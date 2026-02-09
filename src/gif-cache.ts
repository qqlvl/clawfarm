import { GifSource } from 'pixi.js/gif';

const agentGifUrls = Object.entries(
  import.meta.glob('./assets/character/*.gif', { query: '?url', import: 'default', eager: true })
)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, url]) => url as string);

let cached: GifSource[] | null = null;
let loading: Promise<GifSource[]> | null = null;

export function getAgentGifUrls(): string[] {
  return agentGifUrls;
}

// Limit GIF loading to improve performance (we only need ~8-20 for typical agent count)
const MAX_GIFS_TO_LOAD = 100;

export async function getAgentGifSources(): Promise<GifSource[]> {
  if (cached) return cached;
  if (loading) return loading;

  loading = (async () => {
    const sources: GifSource[] = [];
    const urlsToLoad = agentGifUrls.slice(0, MAX_GIFS_TO_LOAD);

    for (const url of urlsToLoad) {
      try {
        const response = await fetch(url);
        const buffer = await response.arrayBuffer();
        const src = GifSource.from(buffer, { fps: 10 });

        // Basic validation: just check frames exist
        // (texture.valid check is too early - textures load async)
        if (src && src.frames && src.frames.length > 0 && src.frames[0]) {
          sources.push(src);
        }
      } catch {
        // skip failed avatar
      }
    }
    cached = sources;
    console.log(`GIF cache: loaded ${sources.length} GIF sources from ${urlsToLoad.length} files`);
    return sources;
  })();

  return loading;
}
