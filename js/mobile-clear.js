(() => {
  const params = new URLSearchParams(window.location.search);
  const code = (params.get('code') || '').trim();
  const codeDisplay = document.querySelector('[data-code-display]');
  const backButton = document.querySelector('[data-back-button]');

  const buildDestination = (baseUrl) =>
    code ? `${baseUrl}?code=${encodeURIComponent(code)}` : baseUrl;

  if (codeDisplay) {
    codeDisplay.textContent = code ? `接続コード: ${code}` : '接続コード未取得';
  }

  if (backButton) {
    backButton.setAttribute('href', buildDestination('mobile-problem.html'));
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
    navigationSocket.emit('join', { room: code, role: 'mobile' });
  };

  if (navigationSocket.connected) {
    joinRoom();
  }

  navigationSocket.on('connect', joinRoom);
  navigationSocket.on('reconnect', joinRoom);

  const notifyBackNavigation = () => {
    if (!code) return;
    navigationSocket.emit('navigateBack', { room: code, role: 'mobile' });
  };

  const goToWaitScreen = () => {
    const url = buildDestination('mobile-problem.html');
    window.location.replace(url);
  };

  const setupBackNavigation = () => {
    if (!window.history || !window.history.pushState) {
      return;
    }

    const stateKey = { page: 'mobile-clear' };

    try {
      const currentState = window.history.state || {};
      window.history.replaceState({ ...currentState, ...stateKey }, document.title);
    } catch (error) {
      return;
    }

    const handlePopState = () => {
      window.removeEventListener('popstate', handlePopState);
      notifyBackNavigation();
      goToWaitScreen();
    };

    window.addEventListener('popstate', handlePopState);

    try {
      const duplicatedState = { ...(window.history.state || {}), ...stateKey, duplicated: true };
      window.history.pushState(duplicatedState, document.title);
    } catch (error) {
      window.removeEventListener('popstate', handlePopState);
    }
  };

  setupBackNavigation();

  if (backButton) {
    backButton.addEventListener('click', (event) => {
      event.preventDefault();
      notifyBackNavigation();
      goToWaitScreen();
    });
  }

  navigationSocket.on('navigateBack', ({ room, code: payloadCode } = {}) => {
    const roomCode = room || payloadCode;
    if (!roomCode || (code && roomCode !== code)) return;
    goToWaitScreen();
  });

  const destinationMap = {
    '1': 'mobile-next.html',
    '2': 'mobile-next.html',
    '3': 'mobile-problem3.html',
    '4': 'mobile-next.html',
    '5': 'mobile-next.html',
    '6': 'mobile-problem6.html',
  };

  const goToProblem = (problem, destinations) => {
    const fallbackDestination = destinationMap[problem] || destinationMap['1'];
    const mobileDest = destinations?.mobile || fallbackDestination || 'mobile-next.html';
    const url = buildDestination(mobileDest);
    window.location.replace(url);
  };

  navigationSocket.on('problemSelected', (payload = {}) => {
    const { room, code: payloadCode, problem, destinations } = payload;
    const roomCode = room || payloadCode;
    if (!roomCode || (code && roomCode !== code)) return;
    goToProblem(problem, destinations);
  });

  navigationSocket.on('status', ({ room, code: payloadCode, step, problem, destinations } = {}) => {
    const roomCode = room || payloadCode;
    if (!roomCode || (code && roomCode !== code)) return;
    if (step === 'problemSelected') {
      goToProblem(problem, destinations);
    }
  });
})();
