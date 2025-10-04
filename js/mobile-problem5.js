(() => {
  const audioUtils = window.Problem5AudioState || {};
  const clampAudioLevel = audioUtils.clampAudioLevel || ((value) => {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) return 0;
    if (number >= 1) return 1;
    return number;
  });
  const calculateRms = audioUtils.calculateRmsFromTimeDomain || ((data) => {
    if (!data || typeof data.length !== 'number' || data.length === 0) return 0;
    let sum = 0;
    for (let i = 0; i < data.length; i += 1) {
      const sample = (Number(data[i]) - 128) / 128;
      sum += sample * sample;
    }
    return Math.sqrt(sum / data.length);
  });

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
  const levelBar = document.querySelector('[data-level-bar]');
  const levelValue = document.querySelector('[data-level-value]');
  const micButton = document.querySelector('[data-mic-button]');
  const feedbackDisplay = document.querySelector('[data-feedback]');
  const form = document.querySelector('[data-password-form]');
  const input = document.querySelector('[data-password-input]');
  const backButton = document.querySelector('[data-back-button]');

  const fallbackPassword = 'ECHO-VOICE';
  const password = (main?.dataset?.password || '').trim() || fallbackPassword;

  if (codeDisplay) {
    codeDisplay.textContent = code ? `接続コード: ${code}` : '接続コード未取得';
  }

  const setStatusMessage = (message) => {
    if (!statusDisplay) return;
    statusDisplay.textContent = message || '';
  };

  const setLevel = (level) => {
    const clamped = clampAudioLevel(level);
    const percent = Math.round(clamped * 100);
    if (levelBar) {
      levelBar.style.setProperty('--audio-level', `${percent}%`);
      levelBar.style.width = `${percent}%`;
    }
    if (levelValue) {
      levelValue.textContent = `音量: ${percent}%`;
    }
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

    const stateKey = { page: 'mobile-problem5' };

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

  const audioState = {
    context: null,
    analyser: null,
    dataArray: null,
    stream: null,
    rafHandle: 0,
    lastSentAt: 0,
    lastLevel: 0,
    active: false,
  };

  const SEND_INTERVAL = 150;
  const MIN_DELTA = 0.03;

  const stopMicrophone = () => {
    audioState.active = false;
    if (audioState.rafHandle) {
      cancelAnimationFrame(audioState.rafHandle);
      audioState.rafHandle = 0;
    }
    if (audioState.stream) {
      audioState.stream.getTracks().forEach((track) => track.stop());
      audioState.stream = null;
    }
    if (audioState.context && audioState.context.state !== 'closed') {
      audioState.context.close().catch(() => {});
    }
    audioState.context = null;
    audioState.analyser = null;
    audioState.dataArray = null;
    audioState.lastLevel = 0;
    setLevel(0);
    setStatusMessage('マイクは停止中です。');
    if (micButton) {
      micButton.disabled = false;
      micButton.textContent = 'マイクを開始';
    }
  };

  const sendAudioLevel = (level, peak) => {
    if (!code) return;
    navigationSocket.emit('audioLevel', {
      room: code,
      level: clampAudioLevel(level),
      peak: clampAudioLevel(peak),
      t: Date.now(),
    });
  };

  const analyzeFrame = () => {
    if (!audioState.active || !audioState.analyser || !audioState.dataArray) {
      return;
    }

    audioState.analyser.getByteTimeDomainData(audioState.dataArray);
    const rms = calculateRms(audioState.dataArray);
    const level = Math.min(1, Math.max(0, rms * 2));
    setLevel(level);

    const now = performance.now();
    const previousLevel = audioState.lastLevel;
    if (
      Math.abs(level - previousLevel) >= MIN_DELTA
      || now - audioState.lastSentAt >= SEND_INTERVAL
    ) {
      audioState.lastLevel = level;
      audioState.lastSentAt = now;
      sendAudioLevel(level, Math.max(level, previousLevel));
    }

    audioState.rafHandle = requestAnimationFrame(analyzeFrame);
  };

  const startMicrophone = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setFeedbackMessage('お使いの端末ではマイクが利用できません。');
      return;
    }

    try {
      if (micButton) {
        micButton.disabled = true;
        micButton.textContent = '起動中…';
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        setFeedbackMessage('AudioContext に対応していません。別のブラウザをご利用ください。');
        stopMicrophone();
        return;
      }

      const context = new AudioContextClass();
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      const bufferLength = analyser.fftSize;
      const dataArray = new Uint8Array(bufferLength);

      source.connect(analyser);

      audioState.context = context;
      audioState.analyser = analyser;
      audioState.dataArray = dataArray;
      audioState.stream = stream;
      audioState.active = true;
      audioState.lastSentAt = 0;
      audioState.lastLevel = 0;

      setStatusMessage('マイクを計測中です。周囲の音を出してください。');
      setFeedbackMessage('');
      if (micButton) {
        micButton.disabled = false;
        micButton.textContent = 'マイクを停止';
      }

      if (context.state === 'suspended') {
        await context.resume();
      }

      audioState.rafHandle = requestAnimationFrame(analyzeFrame);
    } catch (error) {
      setFeedbackMessage('マイクの起動に失敗しました。設定をご確認ください。');
      stopMicrophone();
    }
  };

  if (micButton) {
    micButton.addEventListener('click', () => {
      if (audioState.active) {
        stopMicrophone();
        return;
      }
      startMicrophone();
    });
  }

  const scheduleAutoStart = () => {
    const attemptStart = () => {
      startMicrophone();
    };

    const visibility = document.visibilityState;
    if (typeof visibility !== 'string' || visibility === 'visible') {
      attemptStart();
      return;
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        attemptStart();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange, { once: true });
  };

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    scheduleAutoStart();
  } else {
    window.addEventListener('load', scheduleAutoStart, { once: true });
  }

  window.addEventListener('beforeunload', stopMicrophone);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      stopMicrophone();
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
        setFeedbackMessage('正解です！PC画面の指示を確認しましょう。');
      } else {
        setFeedbackMessage('パスワードが一致しません。もう一度PC側を確認してください。');
      }
    });
  }

  navigationSocket.on('status', ({ room, code: payloadCode, step, audio } = {}) => {
    const roomCode = room || payloadCode;
    if (!roomCode || (code && roomCode !== code)) return;
    if (step === 'problemSelection') {
      goBackToProblem();
      return;
    }
    if (audio && typeof audio.level === 'number') {
      setLevel(audio.level);
    }
    if (audio && audio.thresholdReached) {
      setStatusMessage('十分な音量を検出しました！PC側でキーワードを確認しましょう。');
    }
  });

  navigationSocket.on('audioLevel', ({ room, code: payloadCode, level, thresholdReached } = {}) => {
    const roomCode = room || payloadCode;
    if (!roomCode || (code && roomCode !== code)) return;
    if (typeof level === 'number') {
      setLevel(level);
    }
    if (thresholdReached) {
      setStatusMessage('十分な音量を検出しました！PC側でキーワードを確認しましょう。');
    }
  });
})();
