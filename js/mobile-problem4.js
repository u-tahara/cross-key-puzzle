
(() => {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code') || '';

  const main = document.querySelector('main[data-password]');
  const codeDisplay = document.querySelector('[data-code-display]');
  const statusDisplay = document.querySelector('[data-status]');
  const headingDisplay = document.querySelector('[data-heading]');
  const directionDisplay = document.querySelector('[data-direction]');
  const progressItems = Array.from(
    document.querySelectorAll('[data-direction-item]'),
  ).reduce((map, item) => {
    const key = item.dataset.directionItem;
    if (key) {
      map.set(key, item);
    }
    return map;
  }, new Map());
  const permissionButton = document.querySelector('[data-permission-button]');
  const form = document.querySelector('[data-password-form]');
  const input = document.querySelector('[data-password-input]');
  const feedbackDisplay = document.querySelector('[data-feedback]');
  const backButton = document.querySelector('[data-back-button]');

  const fallbackPassword = 'NAVIGATOR';
  const password = (main?.dataset?.password || '').trim() || fallbackPassword;
  const successUrl = (main?.dataset?.successUrl || '').trim();
  const successNavigator = window.PasswordSuccess?.createSuccessNavigator
    ? window.PasswordSuccess.createSuccessNavigator({
        successUrl,
        code,
        location: window.location,
      })
    : null;

  const navigateToSuccess = successNavigator
    ? () => {
        successNavigator.navigate();
      }
    : () => {
        if (!successUrl) return;
        const url = code ? `${successUrl}?code=${encodeURIComponent(code)}` : successUrl;
        window.location.replace(url);
      };

  if (codeDisplay) {
    codeDisplay.textContent = code ? `接続コード: ${code}` : '接続コード未取得';
  }

  const DIRECTION_LABELS = {
    north: '北 (N)',
    east: '東 (E)',
    south: '南 (S)',
    west: '西 (W)',
  };

  const visitedState = {
    north: false,
    east: false,
    south: false,
    west: false,
  };

  const orientationState = {
    active: false,
    lastHeading: null,
    lastDirection: null,
    lastSent: 0,
  };

  const clampHeading = (value) => {
    if (!Number.isFinite(value)) return null;
    const normalized = value % 360;
    return normalized < 0 ? normalized + 360 : normalized;
  };

  const determineDirection = (heading) => {
    const normalized = clampHeading(heading);
    if (normalized === null) return null;
    if (normalized >= 315 || normalized < 45) return 'north';
    if (normalized >= 45 && normalized < 135) return 'east';
    if (normalized >= 135 && normalized < 225) return 'south';
    if (normalized >= 225 && normalized < 315) return 'west';
    return null;
  };

  const describeDirection = (direction) => {
    switch (direction) {
      case 'north':
        return '北を向いています';
      case 'east':
        return '東を向いています';
      case 'south':
        return '南を向いています';
      case 'west':
        return '西を向いています';
      default:
        return '';
    }
  };

  const setStatusMessage = (message = '') => {
    if (!statusDisplay) return;
    statusDisplay.textContent = message;
  };

  const setFeedbackMessage = (message = '') => {
    if (!feedbackDisplay) return;
    feedbackDisplay.textContent = message;
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

  const updateProgressView = () => {
    progressItems.forEach((element, key) => {
      const completed = Boolean(visitedState[key]);
      const label = DIRECTION_LABELS[key] || key;
      element.textContent = `${label}: ${completed ? '達成' : '未達成'}`;
      element.classList.toggle('is-complete', completed);
    });
  };

  updateProgressView();

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

  const isProblemSolvedStep = (value) =>
    typeof value === 'string' && value.trim().toLowerCase() === 'problemsolved';

  let hasNotifiedProblemSolved = false;

  const notifyProblemSolved = () => {
    if (hasNotifiedProblemSolved || !code) {
      return;
    }
    hasNotifiedProblemSolved = true;
    navigationSocket.emit('problemSolved', { room: code, role: 'mobile' });
  };

  const handleProblemSolved = ({ room, code: payloadCode } = {}) => {
    const roomCode = room || payloadCode;
    if (!roomCode || (code && roomCode !== code)) {
      return;
    }
    hasNotifiedProblemSolved = true;
    navigateToSuccess();
  };

  navigationSocket.on('problemSolved', handleProblemSolved);

  const notifyBackNavigation = () => {
    if (!code) return;
    navigationSocket.emit('navigateBack', { room: code, role: 'mobile' });
  };

  const goBackToProblem = () => {
    const baseUrl = 'mobile-problem.html';
    const url = code ? `${baseUrl}?code=${encodeURIComponent(code)}` : baseUrl;
    window.location.replace(url);
  };

  const setupBackNavigation = () => {
    if (!window.history || !window.history.pushState) {
      return;
    }

    const stateKey = { page: 'mobile-problem4' };

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

  const computeHeadingFromEvent = (event) => {
    if (!event) return null;

    if (typeof event.webkitCompassHeading === 'number') {
      return clampHeading(event.webkitCompassHeading);
    }

    if (typeof event.alpha === 'number') {
      return clampHeading(360 - event.alpha);
    }

    return null;
  };

  const createVisitedSnapshot = () => Object.keys(visitedState).reduce((snapshot, key) => {
    snapshot[key] = Boolean(visitedState[key]);
    return snapshot;
  }, {});

  const sendHeadingState = (heading, direction) => {
    if (!code) return;
    const payload = { room: code, code, heading, visited: createVisitedSnapshot() };
    if (direction) {
      payload.direction = direction;
    }
    navigationSocket.emit('heading', payload);
  };

  const markVisited = (direction) => {
    if (!direction || !Object.prototype.hasOwnProperty.call(visitedState, direction)) {
      return false;
    }
    if (visitedState[direction]) {
      return false;
    }
    visitedState[direction] = true;
    updateProgressView();
    return true;
  };

  const applyOrientationSnapshot = ({ heading, direction, visited } = {}) => {
    if (typeof heading === 'number') {
      setHeadingValue(heading);
      orientationState.lastHeading = heading;
    }

    if (direction) {
      setDirectionValue(direction);
      orientationState.lastDirection = direction;
    }

    if (visited && typeof visited === 'object') {
      Object.keys(visitedState).forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(visited, key)) {
          visitedState[key] = Boolean(visited[key]);
        }
      });
      updateProgressView();
    }
  };

  const handleOrientation = (event) => {
    const heading = computeHeadingFromEvent(event);
    if (heading === null) {
      setStatusMessage('方位を検出できませんでした。端末を水平に保ってください。');
      return;
    }

    const direction = determineDirection(heading);

    setHeadingValue(heading);
    setDirectionValue(direction);

    const now = performance.now();
    const headingChanged =
      orientationState.lastHeading === null
      || Math.abs(heading - orientationState.lastHeading) >= 2;
    const directionChanged = direction && direction !== orientationState.lastDirection;

    if (direction) {
      const firstDiscovery = markVisited(direction);
      if (firstDiscovery) {
        setStatusMessage(`${describeDirection(direction)}。断片を発見しました！`);
      } else {
        setStatusMessage(describeDirection(direction) || '方位を計測中です');
      }
    } else {
      setStatusMessage('方位を探しています…');
    }

    if (
      headingChanged
      || directionChanged
      || now - orientationState.lastSent >= 400
    ) {
      sendHeadingState(heading, direction || undefined);
      orientationState.lastHeading = heading;
      orientationState.lastDirection = direction || null;
      orientationState.lastSent = now;
    }
  };

  const stopCompass = () => {
    if (!orientationState.active) {
      return;
    }
    window.removeEventListener('deviceorientation', handleOrientation);
    orientationState.active = false;
    orientationState.lastHeading = null;
    orientationState.lastDirection = null;
    orientationState.lastSent = 0;
    if (permissionButton) {
      permissionButton.disabled = false;
      permissionButton.textContent = 'コンパスを開始';
    }
  };

  const startCompass = async () => {
    if (orientationState.active) {
      return;
    }

    if (permissionButton) {
      permissionButton.disabled = true;
    }

    if (typeof window.DeviceOrientationEvent === 'undefined') {
      setStatusMessage('この端末では方位センサーを利用できません。');
      if (permissionButton) {
        permissionButton.disabled = false;
      }
      return;
    }

    if (
      typeof window.DeviceOrientationEvent.requestPermission === 'function'
    ) {
      try {
        const result = await window.DeviceOrientationEvent.requestPermission();
        if (result !== 'granted') {
          setStatusMessage('センサーの利用が許可されませんでした。設定を確認してください。');
          if (permissionButton) {
            permissionButton.disabled = false;
          }
          return;
        }
      } catch (error) {
        setStatusMessage('センサーの利用許可を取得できませんでした。');
        if (permissionButton) {
          permissionButton.disabled = false;
        }
        return;
      }
    }

    window.addEventListener('deviceorientation', handleOrientation, { passive: true });
    orientationState.active = true;
    setStatusMessage('スマホをゆっくり回転させて方位を計測してください。');
    if (permissionButton) {
      permissionButton.textContent = '計測中…';
    }
  };

  if (permissionButton) {
    permissionButton.addEventListener('click', () => {
      startCompass();
    });
  }

  window.addEventListener('beforeunload', () => {
    stopCompass();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      stopCompass();
    }
  });

  if (form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const value = input?.value?.trim();
      if (!value) {
        setFeedbackMessage('パスワードを入力してください。');
        return;
      }

      if (value.toUpperCase() === password.toUpperCase()) {
        setFeedbackMessage('正解です！PC画面に表示された断片を順番に並べられました。');
        notifyProblemSolved();
        navigateToSuccess();
      } else {
        setFeedbackMessage('パスワードが一致しません。断片の順番をもう一度確認してください。');
      }
    });
  }

  navigationSocket.on('status', ({ room, code: payloadCode, orientation, step } = {}) => {
    const roomCode = room || payloadCode;
    if (!roomCode || (code && roomCode !== code)) {
      return;
    }

    if (isProblemSolvedStep(step)) {
      handleProblemSolved({ room: roomCode });
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
