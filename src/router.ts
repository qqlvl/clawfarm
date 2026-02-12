export type Route =
  | { view: 'landing' }
  | { view: 'farms'; page: number }
  | { view: 'farm'; row: number; col: number }
  | { view: 'leaderboard' }
  | { view: 'market' }
  | { view: 'shop' };

export type RouteHandler = (route: Route) => void;

export class Router {
  private handler: RouteHandler;

  constructor(handler: RouteHandler) {
    this.handler = handler;

    // Ensure hash exists on initial load
    if (!window.location.hash) {
      window.location.hash = '#/';
    }

    window.addEventListener('hashchange', () => this.resolve());
  }

  resolve(): void {
    const hash = window.location.hash || '#/';
    const route = this.parse(hash);
    this.handler(route);
  }

  navigate(hash: string): void {
    window.location.hash = hash;
  }

  private parse(hash: string): Route {
    const farmMatch = hash.match(/^#\/farm\/(\d+)-(\d+)$/);
    if (farmMatch) {
      return { view: 'farm', row: parseInt(farmMatch[1]), col: parseInt(farmMatch[2]) };
    }

    if (hash.startsWith('#/farms')) {
      const pageMatch = hash.match(/page=(\d+)/);
      return { view: 'farms', page: pageMatch ? parseInt(pageMatch[1]) : 0 };
    }

    if (hash === '#/leaderboard') {
      return { view: 'leaderboard' };
    }

    if (hash === '#/market') {
      return { view: 'market' };
    }

    if (hash === '#/shop') {
      return { view: 'shop' };
    }

    return { view: 'landing' };
  }
}
