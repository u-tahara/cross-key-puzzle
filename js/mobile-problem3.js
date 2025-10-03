(() => {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code') || '';
  const main = document.querySelector('main[data-password]');
  const codeDisplay = document.querySelector('[data-code-display]');
  const statusDisplay = document.querySelector('[data-status]');
  const feedbackDisplay = document.querySelector('[data-feedback]');
  const cameraButton = document.querySelector('[data-camera-button]');
  const preview = document.querySelector('[data-preview]');
  const form = document.querySelector('[data-password-form]');
  const input = document.querySelector('[data-password-input]');
  const backButton = document.querySelector('[data-back-button]');

  const fallbackPassword = 'SHADOW-ACCESS';
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

  const setStatusMessage = (message = '') => {
    if (!statusDisplay) return;
    statusDisplay.textContent = message;
  };

  const setFeedbackMessage = (message = '') => {
    if (!feedbackDisplay) return;
    feedbackDisplay.textContent = message;
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

    const stateKey = { page: 'mobile-problem3' };

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

  const clamp = (value) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    if (number < 0) return 0;
    if (number > 1) return 1;
    return number;
  };

  const sendLightLevel = (level) => {
    if (!code) return;
    navigationSocket.emit('lightLevel', { room: code, level: clamp(level), t: Date.now() });
  };

  const brightnessState = {
    lastSent: 0,
    lastLevel: -1,
  };

  const SAMPLE_SIZE = 48;
  const SEND_INTERVAL_MS = 220;
  const MIN_DELTA = 0.04;

  const canvas = document.createElement('canvas');
  canvas.width = SAMPLE_SIZE;
  canvas.height = SAMPLE_SIZE;
  const context = canvas.getContext('2d', { willReadFrequently: true });

  let analyzeFrameHandle = null;
  let mediaStream = null;

  const stopCamera = () => {
    if (analyzeFrameHandle) {
      cancelAnimationFrame(analyzeFrameHandle);
      analyzeFrameHandle = null;
    }
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
      mediaStream = null;
    }
    if (preview) {
      preview.srcObject = null;
      preview.classList.remove('is-active');
    }
    if (cameraButton) {
      cameraButton.disabled = false;
    }
  };

  const formatPercent = (level) => `${Math.round(level * 100)}%`;

  const analyzeFrame = () => {
    if (!preview || !context) {
      return;
    }

    if (preview.readyState < 2) {
      analyzeFrameHandle = requestAnimationFrame(analyzeFrame);
      return;
    }

    context.drawImage(preview, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
    const { data } = context.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
    const totalPixels = data.length / 4;

    if (!totalPixels) {
      analyzeFrameHandle = requestAnimationFrame(analyzeFrame);
      return;
    }

    let luminanceSum = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      luminanceSum += r * 0.2126 + g * 0.7152 + b * 0.0722;
    }

    const brightness = clamp(luminanceSum / (totalPixels * 255));
    const now = performance.now();

    if (
      Math.abs(brightness - brightnessState.lastLevel) >= MIN_DELTA
      || now - brightnessState.lastSent >= SEND_INTERVAL_MS
    ) {
      brightnessState.lastLevel = brightness;
      brightnessState.lastSent = now;
      sendLightLevel(brightness);
      setStatusMessage(`現在の明るさ: ${formatPercent(brightness)}`);
    }

    analyzeFrameHandle = requestAnimationFrame(analyzeFrame);
  };

  const startCamera = async () => {
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      setStatusMessage('この端末ではカメラを利用できません。');
      return;
    }

    if (cameraButton) {
      cameraButton.disabled = true;
    }

    setStatusMessage('カメラを準備しています…');

    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });
    } catch (error) {
      setStatusMessage('カメラを起動できませんでした。周囲の明るさを手動で調整してください。');
      if (cameraButton) {
        cameraButton.disabled = false;
      }
      return;
    }

    if (preview) {
      preview.srcObject = mediaStream;
      preview.classList.add('is-active');
      const playPromise = preview.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {});
      }
    }

    setStatusMessage('カメラから明るさを取得しています…');
    brightnessState.lastLevel = -1;
    brightnessState.lastSent = 0;
    analyzeFrameHandle = requestAnimationFrame(analyzeFrame);
  };

  if (cameraButton) {
    cameraButton.addEventListener('click', () => {
      if (!mediaStream) {
        startCamera();
      }
    });
  }

  window.addEventListener('beforeunload', stopCamera);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      stopCamera();
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
        setFeedbackMessage('正解です！PC側で背景が暗くなるとパスワードが現れます。');
        notifyProblemSolved();
        navigateToSuccess();
      } else {
        setFeedbackMessage('パスワードが一致しません。PC画面をもう一度確認してください。');
      }
    });
  }

  navigationSocket.on('status', ({ room, code: payloadCode, lightLevel, step } = {}) => {
    const roomCode = room || payloadCode;
    if (!roomCode || (code && roomCode !== code)) return;
    if (isProblemSolvedStep(step)) {
      handleProblemSolved({ room: roomCode });
      return;
    }
    if (typeof lightLevel === 'number') {
      setStatusMessage(`現在の明るさ: ${formatPercent(clamp(lightLevel))}`);
    }
  });

  navigationSocket.on('lightLevel', ({ room, code: payloadCode, level } = {}) => {
    const roomCode = room || payloadCode;
    if (!roomCode || (code && roomCode !== code)) return;
    if (typeof level === 'number') {
      setStatusMessage(`現在の明るさ: ${formatPercent(clamp(level))}`);
    }
  });
})();
