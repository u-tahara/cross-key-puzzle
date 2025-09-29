(function (global) {
  const DEFAULT_ENDPOINT = 'https://ws.u-tahara.jp';

  const isString = (value) => typeof value === 'string';

  const isLoopbackHost = (hostname) => {
    if (!isString(hostname)) return false;
    const normalized = hostname.toLowerCase();
    return normalized === 'localhost'
      || normalized === '127.0.0.1'
      || normalized === '[::1]';
  };

  const isPrivateIPv4 = (hostname) => {
    if (!isString(hostname)) return false;
    if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)) return false;

    const [a, b] = hostname.split('.').map((part) => Number(part));
    if (Number.isNaN(a) || Number.isNaN(b)) return false;

    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true; // link-local fallback
    return false;
  };

  const isLocalDomain = (hostname) => {
    if (!isString(hostname)) return false;
    const normalized = hostname.toLowerCase();
    return normalized.endsWith('.local') || normalized.endsWith('.test');
  };

  const resolveProtocol = (protocol) => {
    if (protocol === 'http:' || protocol === 'https:') {
      return protocol;
    }
    return 'https:';
  };

  const buildSameOrigin = (loc) => {
    if (!loc || !isString(loc.hostname) || !loc.hostname) {
      return DEFAULT_ENDPOINT;
    }

    if (isString(loc.origin) && loc.origin) {
      return loc.origin;
    }

    const protocol = resolveProtocol(loc.protocol);
    const port = isString(loc.port) && loc.port ? `:${loc.port}` : '';
    return `${protocol}//${loc.hostname}${port}`;
  };

  function detectNavigationWsEndpoint(locationLike) {
    const loc = locationLike || (typeof global !== 'undefined' && global?.location);

    if (!loc || !isString(loc.hostname) || !loc.hostname) {
      return DEFAULT_ENDPOINT;
    }

    const hostname = loc.hostname.toLowerCase();

    if (isLoopbackHost(hostname) || isPrivateIPv4(hostname) || isLocalDomain(hostname)) {
      return '/';
    }

    if (hostname === 'ws.u-tahara.jp') {
      return buildSameOrigin(loc);
    }

    return DEFAULT_ENDPOINT;
  }

  const api = { detectNavigationWsEndpoint };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (global) {
    global.NavigationWs = global.NavigationWs || {};
    if (typeof global.NavigationWs.detectNavigationWsEndpoint !== 'function') {
      global.NavigationWs.detectNavigationWsEndpoint = detectNavigationWsEndpoint;
    }
  }
}(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this)));
