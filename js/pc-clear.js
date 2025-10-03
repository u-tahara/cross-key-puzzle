(() => {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code') || '';
  const codeDisplay = document.querySelector('[data-code-display]');
  const backButton = document.querySelector('[data-back-button]');

  const buildDestination = (baseUrl) =>
    code ? `${baseUrl}?code=${encodeURIComponent(code)}` : baseUrl;

  if (codeDisplay) {
    codeDisplay.textContent = code ? `接続コード: ${code}` : '接続コード未取得';
  }

  if (backButton) {
    backButton.setAttribute('href', buildDestination('pc-problem.html'));
  }

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

    const stateKey = { page: 'pc-clear' };

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
})();
