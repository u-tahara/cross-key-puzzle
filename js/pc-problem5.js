(() => {
  const audioUtils = window.Problem5AudioState || {};
  const clampAudioLevel = audioUtils.clampAudioLevel || ((value) => {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) return 0;
    if (number >= 1) return 1;
    return number;
  });
  const DEFAULT_THRESHOLD = Number.isFinite(audioUtils.DEFAULT_THRESHOLD)
    ? audioUtils.DEFAULT_THRESHOLD
    : 0.35;

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
  const levelBar = document.querySelector('[data-level-bar]');
  const levelValue = document.querySelector('[data-level-value]');
  const thresholdIndicator = document.querySelector('[data-threshold-indicator]');
  const statusDisplay = document.querySelector('[data-status]');
  const passwordDisplay = document.querySelector('[data-password-display]');

  const fallbackPassword = 'ECHO-VOICE';
  const password = (main?.dataset?.password || '').trim() || fallbackPassword;

  if (codeDisplay) {
    codeDisplay.textContent = code ? `接続コード: ${code}` : '接続コード未取得';
  }

  const setLevel = (level) => {
    const clamped = clampAudioLevel(level);
    const percent = Math.round(clamped * 100);
    if (levelBar) {
      levelBar.style.width = `${percent}%`;
    }
    if (levelValue) {
      levelValue.textContent = `音量: ${percent}%`;
    }
  };

  if (thresholdIndicator) {
    const thresholdPercent = Math.round(clampAudioLevel(DEFAULT_THRESHOLD) * 100);
    thresholdIndicator.style.left = `${thresholdPercent}%`;
  }

  const setStatusMessage = (message) => {
    if (!statusDisplay) return;
    statusDisplay.textContent = message || '';
  };

  const revealPassword = () => {
    if (!passwordDisplay) return;
    passwordDisplay.textContent = password;
    passwordDisplay.toggleAttribute('data-hidden', false);
  };

  const hidePassword = () => {
    if (!passwordDisplay) return;
    passwordDisplay.textContent = '????';
    passwordDisplay.toggleAttribute('data-hidden', true);
  };

  hidePassword();
  setLevel(0);
  setStatusMessage('スマホ側でマイクを開始してください。');

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

  const applyAudioState = (audio) => {
    if (!audio) return;
    if (typeof audio.level === 'number') {
      setLevel(audio.level);
    }
    if (audio.thresholdReached) {
      setStatusMessage('十分な音量を検出しました！キーワードが解放されました。');
      revealPassword();
    } else if (typeof audio.level === 'number' && audio.level > 0) {
      setStatusMessage('音量を検出中です。さらに大きな音を出してみましょう。');
    }
  };

  navigationSocket.on('status', ({ room, code: payloadCode, audio } = {}) => {
    const roomCode = room || payloadCode;
    if (!roomCode || (code && roomCode !== code)) return;
    applyAudioState(audio);
  });

  navigationSocket.on('audioLevel', ({ room, code: payloadCode, level, thresholdReached } = {}) => {
    const roomCode = room || payloadCode;
    if (!roomCode || (code && roomCode !== code)) return;
    if (typeof level === 'number') {
      setLevel(level);
    }
    if (thresholdReached) {
      setStatusMessage('十分な音量を検出しました！キーワードが解放されました。');
      revealPassword();
    } else if (typeof level === 'number' && level > 0) {
      setStatusMessage('音量を検出中です。さらに大きな音を出してみましょう。');
    }
  });
})();
