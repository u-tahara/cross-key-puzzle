(() => {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code') || '';
  const main = document.querySelector('main[data-password]');
  const passwordDisplay = document.querySelector('[data-password-text]');
  const passwordLead = document.querySelector('.password-lead');
  const codeDisplay = document.querySelector('[data-code-display]');
  const backButton = document.querySelector('.back-button');
  const body = document.body;

  const fallbackPassword = 'SHADOW-ACCESS';
  const password = (main?.dataset?.password || '').trim() || fallbackPassword;

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

  const splitPasswordIntoSegments = (value, desiredSegments = 3) => {
    const safeValue = (value || '').trim();
    if (!safeValue) return [];

    const characters = Array.from(safeValue);
    const segments = [];
    let start = 0;

    for (let i = 0; i < desiredSegments; i += 1) {
      const remaining = characters.length - start;
      const segmentsLeft = desiredSegments - i;

      if (remaining <= 0) {
        break;
      }

      const size = Math.ceil(remaining / segmentsLeft);
      segments.push(characters.slice(start, start + size).join(''));
      start += size;
    }

    return segments;
  };

  const passwordSegments = splitPasswordIntoSegments(password);
  let currentSegmentIndex = -1;

  const determineSegmentIndex = (rawLevel) => {
    if (!passwordSegments.length) return -1;
    if (!Number.isFinite(rawLevel)) return -1;

    const normalized = clamp(rawLevel);
    const inverted = 1 - normalized;
    const segmentSize = 1 / passwordSegments.length;
    const index = Math.floor(inverted / segmentSize);

    if (index < 0) return 0;
    if (index >= passwordSegments.length) {
      return passwordSegments.length - 1;
    }

    return index;
  };

  const updatePasswordSegment = (level) => {
    const nextIndex = determineSegmentIndex(level);

    if (nextIndex === currentSegmentIndex) {
      return;
    }

    currentSegmentIndex = nextIndex;

    const hasSegment = nextIndex >= 0 && nextIndex < passwordSegments.length;
    const segment = hasSegment ? passwordSegments[nextIndex] : '';

    if (passwordDisplay) {
      passwordDisplay.textContent = segment;
      passwordDisplay.toggleAttribute('data-hidden', !hasSegment);
    }

    if (passwordLead) {
      if (hasSegment) {
        passwordLead.textContent = `PASSWORD (パート ${nextIndex + 1}/${passwordSegments.length})`;
        passwordLead.toggleAttribute('data-hidden', false);
      } else {
        passwordLead.textContent = 'PASSWORD';
        passwordLead.toggleAttribute('data-hidden', true);
      }
    }
  };

  const applyLightLevel = (rawLevel) => {
    const level = clamp(rawLevel);
    const shade = Math.round(level * 255);
    body.style.setProperty('--light-level', String(level));
    body.style.backgroundColor = `rgb(${shade}, ${shade}, ${shade})`;
    updatePasswordSegment(level);
  };

  const resetPasswordDisplay = () => {
    currentSegmentIndex = -1;

    if (passwordDisplay) {
      passwordDisplay.textContent = '';
      passwordDisplay.toggleAttribute('data-hidden', true);
    }

    if (passwordLead) {
      passwordLead.textContent = 'PASSWORD';
      passwordLead.toggleAttribute('data-hidden', true);
    }
  };

  resetPasswordDisplay();

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
