(() => {
  const shakeUtils = window.Problem6ShakeState || {};
  const createShakeState = shakeUtils.createShakeState || (() => ({ count: 0, completed: false, lastShakeAt: 0 }));
  const updateShakeState = shakeUtils.updateShakeState || ((state, magnitude, options = {}) => {
    const threshold = Number.isFinite(options.threshold) ? options.threshold : 18;
    const minInterval = Number.isFinite(options.minInterval) ? options.minInterval : 280;
    const required = Number.isFinite(options.required) ? options.required : 8;
    const now = Number.isFinite(options.now) ? options.now : Date.now();
    const safeState = state || createShakeState();
    let { count, completed, lastShakeAt } = safeState;
    let incremented = false;
    if (!completed && Number.isFinite(magnitude) && magnitude >= threshold) {
      const elapsed = now - lastShakeAt;
      const allowInitial = count <= 0 && lastShakeAt <= 0;
      if (allowInitial || elapsed >= minInterval) {
        count += 1;
        lastShakeAt = now;
        incremented = true;
      }
    }
    if (count >= required) {
      completed = true;
    }
    return { count, completed, lastShakeAt, threshold, minInterval, required, incremented };
  });
  const calculateMagnitude = shakeUtils.calculateAccelerationMagnitude || ((x = 0, y = 0, z = 0) => {
    const ax = Number(x) || 0;
    const ay = Number(y) || 0;
    const az = Number(z) || 0;
    return Math.sqrt(ax * ax + ay * ay + az * az);
  });
  const DEFAULT_REQUIRED = Number.isFinite(shakeUtils.DEFAULT_REQUIRED) ? shakeUtils.DEFAULT_REQUIRED : 8;

  const CODE_STORAGE_KEY = 'cross-key-puzzle:code';

  const readCodeFromQuery = () => {
    try {
      const params = new URLSearchParams(window.location.search);
      return (params.get('code') || '').trim();
    } catch (error) {
      return '';
    }
  };

  const readStoredCode = () => {
    try {
      const stored = window.sessionStorage?.getItem(CODE_STORAGE_KEY);
      return (stored || '').trim();
    } catch (error) {
      return '';
    }
  };

  const storeCode = (value) => {
    if (!value) return;
    try {
      window.sessionStorage?.setItem(CODE_STORAGE_KEY, value);
    } catch (error) {
      // セッションストレージが利用できない場合は無視
    }
  };

  const code = (() => {
    const codeFromQuery = readCodeFromQuery();
    if (codeFromQuery) {
      storeCode(codeFromQuery);
      return codeFromQuery;
    }
    const stored = readStoredCode();
    if (stored) {
      return stored;
    }
    return '';
  })();

  const main = document.querySelector('main[data-password]');
  const codeDisplay = document.querySelector('[data-code-display]');
  const statusDisplay = document.querySelector('[data-status]');
  const countDisplay = document.querySelector('[data-count]');
  const permissionButton = document.querySelector('[data-permission-button]');
  const feedbackDisplay = document.querySelector('[data-feedback]');
  const form = document.querySelector('[data-password-form]');
  const input = document.querySelector('[data-password-input]');
  const backButton = document.querySelector('[data-back-button]');

  const fallbackPassword = 'RHYTHM-RISE';
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

  const setStatusMessage = (message) => {
    if (!statusDisplay) return;
    statusDisplay.textContent = message || '';
  };

  const setCountValue = (count) => {
    if (!countDisplay) return;
    const number = Number(count) || 0;
    countDisplay.textContent = `振った回数: ${number} 回`;
  };

  const setFeedbackMessage = (message) => {
    if (!feedbackDisplay) return;
    feedbackDisplay.textContent = message || '';
  };

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

    const stateKey = { page: 'mobile-problem6' };

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

  const motionState = {
    active: false,
    shakeState: createShakeState(),
    handler: null,
  };

  const REQUIRED_SHAKES = DEFAULT_REQUIRED || 8;

  const stopMonitoring = () => {
    motionState.active = false;
    if (motionState.handler) {
      window.removeEventListener('devicemotion', motionState.handler);
      motionState.handler = null;
    }
    setStatusMessage('計測は停止中です。');
    if (permissionButton) {
      permissionButton.disabled = false;
      permissionButton.textContent = '計測を開始';
    }
  };

  const sendShakeEvent = (payload) => {
    if (!code) return;
    navigationSocket.emit('shake', {
      room: code,
      magnitude: Number(payload?.magnitude) || 0,
      count: Number(payload?.count) || 0,
      completed: Boolean(payload?.completed),
      t: Date.now(),
    });
  };

  const handleMotion = (event) => {
    if (!motionState.active) {
      return;
    }
    const acceleration = event.accelerationIncludingGravity || event.acceleration;
    if (!acceleration) {
      return;
    }
    const magnitude = calculateMagnitude(acceleration.x, acceleration.y, acceleration.z);
    const now = Date.now();
    const next = updateShakeState(motionState.shakeState, magnitude, { now });
    motionState.shakeState = {
      count: next.count,
      completed: next.completed,
      lastShakeAt: next.lastShakeAt,
    };

    if (next.incremented) {
      setCountValue(next.count);
      sendShakeEvent({ magnitude, count: next.count, completed: next.completed });
      if (next.completed) {
        setStatusMessage('目標回数に到達しました！PC側の表示を確認してください。');
      }
    }
  };

  const requestPermissionIfNeeded = async () => {
    if (typeof DeviceMotionEvent === 'undefined' || !DeviceMotionEvent) {
      return true;
    }
    if (typeof DeviceMotionEvent.requestPermission !== 'function') {
      return true;
    }

    try {
      const result = await DeviceMotionEvent.requestPermission();
      return result === 'granted';
    } catch (error) {
      return false;
    }
  };

  const startMonitoring = async () => {
    if (motionState.active) {
      stopMonitoring();
      return;
    }

    if (permissionButton) {
      permissionButton.disabled = true;
      permissionButton.textContent = '許可を確認中…';
    }

    const granted = await requestPermissionIfNeeded();
    if (!granted) {
      setFeedbackMessage('モーションセンサーの許可が得られませんでした。設定を確認してください。');
      if (permissionButton) {
        permissionButton.disabled = false;
        permissionButton.textContent = '計測を開始';
      }
      return;
    }

    motionState.active = true;
    motionState.shakeState = createShakeState();
    setCountValue(0);
    setFeedbackMessage('');
    setStatusMessage('計測中です。スマホをしっかり振ってください。');
    if (permissionButton) {
      permissionButton.disabled = false;
      permissionButton.textContent = '計測を停止';
    }

    motionState.handler = handleMotion;
    window.addEventListener('devicemotion', motionState.handler, { passive: true });
  };

  if (permissionButton) {
    permissionButton.addEventListener('click', () => {
      if (motionState.active) {
        stopMonitoring();
        return;
      }
      startMonitoring();
    });
  }

  window.addEventListener('beforeunload', stopMonitoring);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      stopMonitoring();
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
        setFeedbackMessage('正解です！PC側の画面を確認しましょう。');
        notifyProblemSolved();
        navigateToSuccess();
      } else {
        setFeedbackMessage('パスワードが一致しません。PC画面を再確認してください。');
      }
    });
  }

  navigationSocket.on('status', ({ room, code: payloadCode, step, shake } = {}) => {
    const roomCode = room || payloadCode;
    if (!roomCode || (code && roomCode !== code)) return;
    if (step === 'problemSelection') {
      goBackToProblem();
      return;
    }
    if (isProblemSolvedStep(step)) {
      handleProblemSolved({ room: roomCode });
      return;
    }
    if (shake && typeof shake.count === 'number') {
      setCountValue(shake.count);
    }
    if (shake && shake.completed) {
      setStatusMessage('目標回数に到達しました！PC側の表示を確認してください。');
    }
  });

  navigationSocket.on('shake', ({ room, code: payloadCode, count, completed } = {}) => {
    const roomCode = room || payloadCode;
    if (!roomCode || (code && roomCode !== code)) return;
    if (typeof count === 'number') {
      setCountValue(count);
    }
    if (completed) {
      setStatusMessage('目標回数に到達しました！PC側の表示を確認してください。');
    }
  });
})();
