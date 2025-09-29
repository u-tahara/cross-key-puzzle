const mazeContainer = document.getElementById('maze');
const code = new URLSearchParams(window.location.search).get('code');
const controllerSocket = new WebSocket('https://ws.u-tahara.jp');

const navigationSocket = io('https://ws.u-tahara.jp', {
  transports: ['websocket'],
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

  const stateKey = { page: 'pc-next' };

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

const width = 5;
const height = 5;
const goal = { x: 4, y: 4 };
const mazeMap = [
  [0, 1, 0, 0, 0],
  [0, 1, 0, 1, 0],
  [0, 0, 0, 1, 0],
  [1, 1, 0, 1, 0],
  [0, 0, 0, 0, 0],
];

const player = { x: 0, y: 0 };

function drawMaze() {
  mazeContainer.innerHTML = '';
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const div = document.createElement('div');
      div.classList.add('cell');
      if (mazeMap[y][x] === 1) div.classList.add('wall');
      if (x === player.x && y === player.y) div.classList.add('player');
      if (x === goal.x && y === goal.y) div.classList.add('goal');
      mazeContainer.appendChild(div);
    }
  }
}

function canMove(x, y) {
  return x >= 0 && x < width && y >= 0 && y < height && mazeMap[y][x] === 0;
}

controllerSocket.addEventListener('open', () => {
  controllerSocket.send(JSON.stringify({ type: 'resume', role: 'pc', code }));
  drawMaze();
});

controllerSocket.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);
  if (data.type !== 'move') {
    return;
  }

  let newX = player.x;
  let newY = player.y;

  if (data.direction === 'up') newY -= 1;
  if (data.direction === 'down') newY += 1;
  if (data.direction === 'left') newX -= 1;
  if (data.direction === 'right') newX += 1;

  if (!canMove(newX, newY)) {
    return;
  }

  player.x = newX;
  player.y = newY;
  drawMaze();

  if (player.x === goal.x && player.y === goal.y) {
    window.alert('ゴール！');
  }
});
