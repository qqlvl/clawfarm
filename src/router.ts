export type Route =
  | { view: 'landing' }
  | { view: 'farms'; page: number }
  | { view: 'farm'; row: number; col: number }
  | { view: 'leaderboard' };

export type RouteHandler = (route: Route) => void;

export class Router {
  private handler: RouteHandler;

  constructor(handler: RouteHandler) {
    this.handler = handler;
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

    return { view: 'landing' };
  }
}
