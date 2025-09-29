(() => {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code') || '';
  const main = document.querySelector('main[data-password]');
  const passwordDisplay = document.querySelector('[data-password-text]');
  const codeDisplay = document.querySelector('[data-code-display]');
  const backButton = document.querySelector('.back-button');
  const body = document.body;

  const fallbackPassword = 'SHADOW-ACCESS';
  const password = (main?.dataset?.password || '').trim() || fallbackPassword;

  if (passwordDisplay) {
    passwordDisplay.textContent = password;
  }

  if (codeDisplay) {
    codeDisplay.textContent = code ? `接続コード: ${code}` : '接続コード未取得';
  }

  const clamp = (value) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return 1;
    if (number < 0) return 0;
    if (number > 1) return 1;
    return number;
  };

  const applyLightLevel = (rawLevel) => {
    const level = clamp(rawLevel);
    const shade = Math.round(level * 255);
    body.style.setProperty('--light-level', String(level));
    body.style.backgroundColor = `rgb(${shade}, ${shade}, ${shade})`;
  };

  applyLightLevel(1);

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

    const stateKey = { page: 'pc-problem3' };

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

  navigationSocket.on('status', ({ room, code: payloadCode, lightLevel } = {}) => {
    const roomCode = room || payloadCode;
    if (!roomCode || (code && roomCode !== code)) return;
    if (typeof lightLevel === 'number') {
      applyLightLevel(lightLevel);
    }
  });

  navigationSocket.on('lightLevel', ({ room, code: payloadCode, level } = {}) => {
    const roomCode = room || payloadCode;
    if (!roomCode || (code && roomCode !== code)) return;
    if (typeof level === 'number') {
      applyLightLevel(level);
    }
  });
})();
