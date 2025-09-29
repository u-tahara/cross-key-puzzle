const controller = document.querySelector('.controller');
const statusDisplay = document.querySelector('.controller-status');
const code = new URLSearchParams(window.location.search).get('code');

const navigationSocket = io('/', {
  transports: ['websocket'],
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

  const stateKey = { page: 'mobile-next' };

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

const backButton = document.querySelector('.back-button');

if (backButton) {
  backButton.addEventListener('click', (event) => {
    event.preventDefault();
    notifyBackNavigation();
    goBackToProblem();
  });
}

navigationSocket.on('navigateBack', ({ room, code: payloadCode } = {}) => {
  const roomCode = room || payloadCode;
  if (!roomCode || roomCode !== code) return;
  goBackToProblem();
});

setupBackNavigation();

const setStatusMessage = (message = '') => {
  if (!statusDisplay) return;
  statusDisplay.textContent = message;
};

const describeDirection = (direction) => {
  if (direction === 'up') return '上に進みました';
  if (direction === 'down') return '下に進みました';
  if (direction === 'left') return '左に進みました';
  if (direction === 'right') return '右に進みました';
  return '';
};

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
    setStatusMessage('その方向には進めません');
    return;
  }

  if (goalReached) {
    setStatusMessage('ゴールしました！');
    return;
  }

  const message = describeDirection(direction);
  if (message) {
    setStatusMessage(message);
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

if (controller) {
  controller.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-direction]');
    if (!button) {
      return;
    }

    const { direction } = button.dataset;
    navigationSocket.emit('moveDirection', { room: code, direction });
    setStatusMessage('操作を送信しました');
  });
}
