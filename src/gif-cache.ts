import { GifSource } from 'pixi.js/gif';

const agentGifUrls = Object.entries(
  import.meta.glob('./assets/character/*.gif', { as: 'url', eager: true })
)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, url]) => url as string);

let cached: GifSource[] | null = null;
let loading: Promise<GifSource[]> | null = null;

export function getAgentGifUrls(): string[] {
  return agentGifUrls;
}

export async function getAgentGifSources(): Promise<GifSource[]> {
  if (cached) return cached;
  if (loading) return loading;

  loading = (async () => {
    const sources: GifSource[] = [];
    for (const url of agentGifUrls) {
      try {
        const response = await fetch(url);
        const buffer = await response.arrayBuffer();
        sources.push(GifSource.from(buffer, { fps: 10 }));
      } catch {
        // skip failed avatar
      }
    }
    cached = sources;
    return sources;
  })();

  return loading;
}
