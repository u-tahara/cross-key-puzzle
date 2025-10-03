const code = new URLSearchParams(window.location.search).get('code');
const codeDisplay = document.querySelector('[data-code-display]');
const statusDisplay = document.querySelector('[data-status]');
const startButton = document.querySelector('[data-start-button]');
const resetButton = document.querySelector('[data-reset-button]');

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

const goToClearPage = () => {
  const baseUrl = 'mobile-clear.html';
  const url = code ? `${baseUrl}?code=${encodeURIComponent(code)}` : baseUrl;
  window.location.replace(url);
};

let hasNotifiedProblemSolved = false;

const joinRoom = () => {
  if (!code) return;
  navigationSocket.emit('join', { room: code, role: 'mobile' });
};

if (navigationSocket.connected) {
  joinRoom();
}

navigationSocket.on('connect', joinRoom);
navigationSocket.on('reconnect', joinRoom);

const notifyProblemSolved = () => {
  if (!code || hasNotifiedProblemSolved) {
    return;
  }

  hasNotifiedProblemSolved = true;
  navigationSocket.emit('problemSolved', { room: code, role: 'mobile' });
};

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

  const stateKey = { page: 'mobile-gyro' };

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

setupBackNavigation();

const setStatusMessage = (message = '') => {
  if (!statusDisplay) return;
  statusDisplay.textContent = message;
};

const describeDirection = (direction) => {
  if (direction === 'up') return '上に進みます';
  if (direction === 'down') return '下に進みます';
  if (direction === 'left') return '左に進みます';
  if (direction === 'right') return '右に進みます';
  return '';
};

const showCode = () => {
  if (!codeDisplay) return;
  codeDisplay.textContent = code ? `接続コード: ${code}` : '接続コード未取得';
};

showCode();
setStatusMessage('「ジャイロ操作を開始」を押して操作を有効にしてください。');

const orientationControl = {
  lastDirection: null,
  lastSentAt: 0,
  needsNeutral: false,
};

const DIRECTION_THRESHOLD = 18; // degrees
const DIRECTION_COOLDOWN_MS = 500;

const normalizeDegree = (value) => (Number.isFinite(value) ? value : 0);

const detectDirectionFromOrientation = (beta, gamma) => {
  const vertical = normalizeDegree(beta);
  const horizontal = normalizeDegree(gamma);

  if (vertical < -DIRECTION_THRESHOLD) return 'up';
  if (vertical > DIRECTION_THRESHOLD) return 'down';
  if (horizontal < -DIRECTION_THRESHOLD) return 'left';
  if (horizontal > DIRECTION_THRESHOLD) return 'right';
  return null;
};

const resetOrientationControl = (announce = true) => {
  orientationControl.lastDirection = null;
  orientationControl.lastSentAt = 0;
  orientationControl.needsNeutral = false;
  if (announce) {
    setStatusMessage('ジャイロの基準をリセットしました。端末をまっすぐに保ってください。');
  }
};

const sendDirection = (direction) => {
  if (!direction) {
    return;
  }

  if (!code) {
    setStatusMessage('接続コードが取得できませんでした。PCでコードを確認してください。');
    return;
  }
  const now = Date.now();

  if (now - orientationControl.lastSentAt < DIRECTION_COOLDOWN_MS) {
    return;
  }

  if (orientationControl.needsNeutral && direction === orientationControl.lastDirection) {
    return;
  }

  navigationSocket.emit('moveDirection', { room: code, direction, t: now });
  const message = describeDirection(direction);
  if (message) {
    setStatusMessage(`${message}（送信）`);
  } else {
    setStatusMessage('操作を送信しました');
  }

  orientationControl.lastDirection = direction;
  orientationControl.lastSentAt = now;
  orientationControl.needsNeutral = true;
};

const handleOrientation = (event) => {
  const { beta, gamma } = event;
  if (typeof beta !== 'number' || typeof gamma !== 'number') {
    return;
  }

  const direction = detectDirectionFromOrientation(beta, gamma);
  if (!direction) {
    orientationControl.needsNeutral = false;
    return;
  }

  sendDirection(direction);
};

let sensorActive = false;

const requestSensorPermission = async () => {
  const constructors = [globalThis.DeviceOrientationEvent, globalThis.DeviceMotionEvent];

  for (const ctor of constructors) {
    if (ctor && typeof ctor.requestPermission === 'function') {
      try {
        const result = await ctor.requestPermission();
        if (result !== 'granted') {
          return false;
        }
      } catch (error) {
        return false;
      }
    }
  }

  return true;
};

const enableSensor = async () => {
  if (sensorActive) return;
  if (!startButton) return;

  startButton.disabled = true;
  setStatusMessage('ジャイロセンサーの利用を確認しています…');

  let permissionGranted = true;
  const constructors = [globalThis.DeviceOrientationEvent, globalThis.DeviceMotionEvent];
  const requiresPermission = constructors.some((ctor) => ctor && typeof ctor.requestPermission === 'function');

  if (requiresPermission) {
    permissionGranted = await requestSensorPermission();
  }

  if (!permissionGranted) {
    startButton.disabled = false;
    setStatusMessage('センサーの利用が許可されませんでした。ブラウザーの設定を確認してください。');
    startButton.textContent = 'もう一度試す';
    return;
  }

  window.addEventListener('deviceorientation', handleOrientation);
  sensorActive = true;
  resetOrientationControl(false);
  startButton.textContent = 'ジャイロ操作中';
  setStatusMessage('端末を傾けてキャラクターを動かしてください。');
  if (resetButton) {
    resetButton.disabled = false;
  }
};

if (startButton) {
  startButton.addEventListener('click', enableSensor);
}

if (resetButton) {
  resetButton.disabled = true;
  resetButton.addEventListener('click', () => {
    if (!sensorActive) {
      return;
    }
    resetOrientationControl();
  });
}

if (startButton && typeof window !== 'undefined' && !('DeviceOrientationEvent' in window)) {
  startButton.disabled = true;
  setStatusMessage('この端末ではジャイロセンサーが利用できません。');
  if (resetButton) {
    resetButton.disabled = true;
  }
}

navigationSocket.on('navigateBack', ({ room, code: payloadCode } = {}) => {
  const roomCode = room || payloadCode;
  if (!roomCode || roomCode !== code) return;
  goBackToProblem();
});

navigationSocket.on('status', ({ room, code: payloadCode, maze } = {}) => {
  const roomCode = room || payloadCode;
  if (code && roomCode && roomCode !== code) {
    return;
  }

  if (maze && maze.player) {
    const { x, y } = maze.player;
    setStatusMessage(`現在位置: (${x}, ${y})`);
  }
});

navigationSocket.on('mazeState', ({ room, code: payloadCode, moved, direction, goalReached, player: position } = {}) => {
  const roomCode = room || payloadCode;
  if (code && roomCode && roomCode !== code) {
    return;
  }

  if (!moved && direction) {
    setStatusMessage('その方向には進めませんでした');
    orientationControl.needsNeutral = false;
    return;
  }

  if (goalReached) {
    setStatusMessage('');
    notifyProblemSolved();
    goToClearPage();
    return;
  }

  const message = describeDirection(direction);
  if (message) {
    setStatusMessage(`${message}（完了）`);
    return;
  }

  if (position) {
    const x = Number(position.x);
    const y = Number(position.y);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      setStatusMessage(`現在位置: (${x}, ${y})`);
      return;
    }
  }
});

const handleProblemSolved = ({ room, code: payloadCode } = {}) => {
  const roomCode = room || payloadCode;
  if (!roomCode || (code && roomCode !== code)) {
    return;
  }

  hasNotifiedProblemSolved = true;
  goToClearPage();
};

navigationSocket.on('problemSolved', handleProblemSolved);

const backButton = document.querySelector('.back-button');

if (backButton) {
  backButton.addEventListener('click', (event) => {
    event.preventDefault();
    notifyBackNavigation();
    goBackToProblem();
  });
}
