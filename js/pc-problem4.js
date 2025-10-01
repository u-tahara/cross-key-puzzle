(() => {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code') || '';

  const main = document.querySelector('main[data-password]');
  const codeDisplay = document.querySelector('[data-code-display]');
  const headingDisplay = document.querySelector('[data-heading-display]');
  const directionDisplay = document.querySelector('[data-direction-display]');
  const passwordDisplay = document.querySelector('[data-password-display]');
  const backButton = document.querySelector('.back-button');

  const fragmentElements = Array.from(document.querySelectorAll('[data-fragment]')).reduce(
    (map, element) => {
      const key = element.dataset.fragment;
      if (!key) {
        return map;
      }
      const text = element.querySelector('[data-fragment-text]');
      map.set(key, { element, text });
      return map;
    },
    new Map(),
  );

  const fallbackPassword = 'NAVIGATOR';
  const password = (main?.dataset?.password || '').trim() || fallbackPassword;

  if (codeDisplay) {
    codeDisplay.textContent = code ? `接続コード: ${code}` : '接続コード未取得';
  }

  const DIRECTION_LABELS = {
    north: '北 (N)',
    east: '東 (E)',
    south: '南 (S)',
    west: '西 (W)',
  };

  const FRAGMENT_MAP = {
    north: 'NA',
    east: 'VI',
    south: 'GA',
    west: 'TOR',
  };

  const ORDER = ['north', 'east', 'south', 'west'];

  const orientationState = {
    heading: null,
    direction: null,
    visited: {
      north: false,
      east: false,
      south: false,
      west: false,
    },
  };

  const clampHeading = (value) => {
    if (!Number.isFinite(value)) return null;
    const normalized = value % 360;
    return normalized < 0 ? normalized + 360 : normalized;
  };

  const setHeadingValue = (value) => {
    if (!headingDisplay) return;
    if (!Number.isFinite(value)) {
      headingDisplay.textContent = '方位角: --°';
      return;
    }
    const clamped = clampHeading(value);
    const rounded = Math.round((clamped ?? 0) * 10) / 10;
    headingDisplay.textContent = `方位角: ${rounded.toFixed(1)}°`;
  };

  const setDirectionValue = (direction) => {
    if (!directionDisplay) return;
    if (!direction) {
      directionDisplay.textContent = '方向: 未検出';
      return;
    }
    const label = DIRECTION_LABELS[direction] || '不明';
    directionDisplay.textContent = `方向: ${label}`;
  };

  const setActiveDirection = (direction) => {
    fragmentElements.forEach(({ element }, key) => {
      element.classList.toggle('is-active', Boolean(direction) && key === direction);
    });
  };

  const setFragmentState = (direction, isFound) => {
    const entry = fragmentElements.get(direction);
    if (!entry) {
      return;
    }

    const text = entry.text;
    if (text) {
      text.textContent = isFound ? FRAGMENT_MAP[direction] || '--' : '--';
    }

    entry.element.classList.toggle('is-found', Boolean(isFound));
  };

  const refreshFragments = () => {
    ORDER.forEach((direction) => {
      const isFound = Boolean(orientationState.visited[direction]);
      setFragmentState(direction, isFound);
    });
  };

  const updatePasswordDisplay = () => {
    if (!passwordDisplay) return;
    const allFound = ORDER.every((direction) => orientationState.visited[direction]);
    if (allFound) {
      const result = ORDER.map((direction) => FRAGMENT_MAP[direction] || '').join('');
      passwordDisplay.textContent = result || password;
      passwordDisplay.toggleAttribute('data-hidden', false);
    } else {
      passwordDisplay.textContent = '????';
      passwordDisplay.toggleAttribute('data-hidden', true);
    }
  };

  refreshFragments();
  updatePasswordDisplay();

  const resolveNavigationEndpoint = () => {
    const helper = window.NavigationWs?.detectNavigationWsEndpoint;
    if (typeof helper === 'function') {
      return helper();
    }
    return 'https://ws.u-tahara.jp';
  };

  const navigationSocket = io(resolveNavigationEndpoint(), {
    transports: ['websocket', 'polling'],
    withCredentials: true,
  });

  const joinRoom = () => {
    if (!code) return;
    navigationSocket.emit('join', { room: code, role: 'pc' });
  };

  if (navigationSocket.connected) {
    joinRoom();
  }

  navigationSocket.on('connect', joinRoom);
  navigationSocket.on('reconnect', joinRoom);

  const notifyBackNavigation = () => {
    if (!code) return;
    navigationSocket.emit('navigateBack', { room: code, role: 'pc' });
  };

  const goBackToProblem = () => {
    const baseUrl = 'pc-problem.html';
    const url = code ? `${baseUrl}?code=${encodeURIComponent(code)}` : baseUrl;
    window.location.replace(url);
  };

  const setupBackNavigation = () => {
    if (!window.history || !window.history.pushState) {
      return;
    }

    const stateKey = { page: 'pc-problem4' };

    try {
      const currentState = window.history.state || {};
      window.history.replaceState({ ...currentState, ...stateKey }, document.title);
    } catch (error) {
      return;
    }

    const handlePopState = () => {
      window.removeEventListener('popstate', handlePopState);
      notifyBackNavigation();
      goBackToProblem();
    };

    window.addEventListener('popstate', handlePopState);

    try {
      const duplicatedState = { ...(window.history.state || {}), ...stateKey, duplicated: true };
      window.history.pushState(duplicatedState, document.title);
    } catch (error) {
      window.removeEventListener('popstate', handlePopState);
    }
  };

  if (backButton) {
    backButton.addEventListener('click', (event) => {
      event.preventDefault();
      notifyBackNavigation();
      goBackToProblem();
    });
  }

  navigationSocket.on('navigateBack', ({ room, code: payloadCode } = {}) => {
    const roomCode = room || payloadCode;
    if (!roomCode || (code && roomCode !== code)) return;
    goBackToProblem();
  });

  setupBackNavigation();

  const applyOrientationSnapshot = ({ heading, direction, visited } = {}) => {
    if (typeof heading === 'number') {
      setHeadingValue(heading);
      orientationState.heading = heading;
    }

    if (visited && typeof visited === 'object') {
      ORDER.forEach((dir) => {
        if (Object.prototype.hasOwnProperty.call(visited, dir)) {
          orientationState.visited[dir] = Boolean(visited[dir]);
        }
      });
      refreshFragments();
      updatePasswordDisplay();
    }

    if (direction) {
      setDirectionValue(direction);
      setActiveDirection(direction);
      orientationState.direction = direction;
    } else if (direction === null) {
      setDirectionValue(null);
      setActiveDirection(null);
      orientationState.direction = null;
    }
  };

  navigationSocket.on('status', ({ room, code: payloadCode, orientation } = {}) => {
    const roomCode = room || payloadCode;
    if (!roomCode || (code && roomCode !== code)) {
      return;
    }

    if (orientation && typeof orientation === 'object') {
      applyOrientationSnapshot(orientation);
    }
  });

  navigationSocket.on('heading', ({ room, code: payloadCode, heading, direction, visited } = {}) => {
    const roomCode = room || payloadCode;
    if (!roomCode || (code && roomCode !== code)) {
      return;
    }

    applyOrientationSnapshot({ heading, direction, visited });
  });
})();
