const controller = document.querySelector('.controller');
const code = new URLSearchParams(window.location.search).get('code');
const controllerSocket = new WebSocket('https://ws.u-tahara.jp');

const navigationSocket = io('https://ws.u-tahara.jp', {
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

controllerSocket.addEventListener('open', () => {
  controllerSocket.send(JSON.stringify({ type: 'resume', role: 'mobile', code }));
});

if (controller) {
  controller.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-direction]');
    if (!button) {
      return;
    }

    const { direction } = button.dataset;
    controllerSocket.send(JSON.stringify({ type: 'move', direction }));
  });
}
