(() => {
  const shakeUtils = window.Problem6ShakeState || {};
  const DEFAULT_REQUIRED = Number.isFinite(shakeUtils.DEFAULT_REQUIRED)
    ? shakeUtils.DEFAULT_REQUIRED
    : 8;

  const params = new URLSearchParams(window.location.search);
  const code = params.get('code') || '';

  const main = document.querySelector('main[data-password]');
  const codeDisplay = document.querySelector('[data-code-display]');
  const countDisplay = document.querySelector('[data-count-display]');
  const requiredDisplay = document.querySelector('[data-required]');
  const progressBar = document.querySelector('[data-progress-bar]');
  const statusDisplay = document.querySelector('[data-status]');
  const passwordDisplay = document.querySelector('[data-password-display]');

  const fallbackPassword = 'RHYTHM-RISE';
  const password = (main?.dataset?.password || '').trim() || fallbackPassword;

  if (codeDisplay) {
    codeDisplay.textContent = code ? `接続コード: ${code}` : '接続コード未取得';
  }

  const state = {
    count: 0,
    required: DEFAULT_REQUIRED,
    completed: false,
  };

  const setStatusMessage = (message) => {
    if (!statusDisplay) return;
    statusDisplay.textContent = message || '';
  };

  const updateView = () => {
    const required = Math.max(1, Number(state.required) || DEFAULT_REQUIRED);
    const count = Math.max(0, Number(state.count) || 0);
    if (requiredDisplay) {
      requiredDisplay.textContent = required;
    }
    if (countDisplay) {
      countDisplay.textContent = `振った回数: ${count} / ${required}`;
    }
    if (progressBar) {
      const ratio = Math.min(1, count / required);
      progressBar.style.width = `${Math.round(ratio * 100)}%`;
    }
    if (state.completed) {
      setStatusMessage('目標回数に到達しました！合言葉が表示されています。');
      if (passwordDisplay) {
        passwordDisplay.textContent = password;
        passwordDisplay.toggleAttribute('data-hidden', false);
      }
    } else {
      if (count > 0) {
        setStatusMessage('振動を検出中です。目標回数まで振り続けましょう。');
      } else {
        setStatusMessage('スマホ側で計測を開始してください。');
      }
      if (passwordDisplay) {
        passwordDisplay.textContent = '????';
        passwordDisplay.toggleAttribute('data-hidden', true);
      }
    }
  };

  updateView();

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

  const applyShakeState = (shake) => {
    if (!shake) return;
    if (typeof shake.count === 'number') {
      state.count = shake.count;
    }
    if (typeof shake.required === 'number' && shake.required > 0) {
      state.required = shake.required;
    }
    if (typeof shake.completed === 'boolean') {
      state.completed = shake.completed;
    }
    updateView();
  };

  navigationSocket.on('status', ({ room, code: payloadCode, shake } = {}) => {
    const roomCode = room || payloadCode;
    if (!roomCode || (code && roomCode !== code)) return;
    applyShakeState(shake);
  });

  navigationSocket.on('shake', ({ room, code: payloadCode, count, completed, required } = {}) => {
    const roomCode = room || payloadCode;
    if (!roomCode || (code && roomCode !== code)) return;
    if (typeof count === 'number') {
      state.count = count;
    }
    if (typeof required === 'number' && required > 0) {
      state.required = required;
    }
    if (typeof completed === 'boolean') {
      state.completed = completed;
    }
    updateView();
  });
})();
