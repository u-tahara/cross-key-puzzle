const mazeContainer = document.getElementById('maze');
const code = new URLSearchParams(window.location.search).get('code');

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

const fallbackConfig = {
  width: 5,
  height: 5,
  goal: { x: 4, y: 4 },
  start: { x: 0, y: 0 },
  map: [
    [0, 1, 0, 0, 0],
    [0, 1, 0, 1, 0],
    [0, 0, 0, 1, 0],
    [1, 1, 0, 1, 0],
    [0, 0, 0, 0, 0],
  ],
};

const resolveMazeConfig = () => {
  const namespace = window.CrossKeyMaze;
  if (namespace && typeof namespace.getMazeConfig === 'function') {
    const key = typeof namespace.DEFAULT_MAZE_KEY === 'string' ? namespace.DEFAULT_MAZE_KEY : '1';
    const config = namespace.getMazeConfig(key);
    if (config) {
      return config;
    }
  }
  return fallbackConfig;
};

const mazeConfig = resolveMazeConfig();
const width = Number(mazeConfig.width) || fallbackConfig.width;
const height = Number(mazeConfig.height) || fallbackConfig.height;
const goal = {
  x: Number(mazeConfig.goal?.x),
  y: Number(mazeConfig.goal?.y),
};
if (!Number.isFinite(goal.x) || !Number.isFinite(goal.y)) {
  goal.x = fallbackConfig.goal.x;
  goal.y = fallbackConfig.goal.y;
}
const mazeMap = Array.isArray(mazeConfig.map) ? mazeConfig.map : fallbackConfig.map;

const player = {
  x: Number(mazeConfig.start?.x),
  y: Number(mazeConfig.start?.y),
};
if (!Number.isFinite(player.x) || !Number.isFinite(player.y)) {
  player.x = fallbackConfig.start.x;
  player.y = fallbackConfig.start.y;
}
let hasGoalAlerted = false;

function drawMaze() {
  if (!mazeContainer) {
    return;
  }

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

const updatePlayer = (position = {}) => {
  const x = Number(position.x);
  const y = Number(position.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return;
  }

  player.x = x;
  player.y = y;
  drawMaze();
};

const handleGoal = (goalReached) => {
  if (goalReached && !hasGoalAlerted) {
    hasGoalAlerted = true;
    window.alert('ゴール！');
  }
  if (!goalReached) {
    hasGoalAlerted = false;
  }
};

drawMaze();

navigationSocket.on('status', ({ room, code: payloadCode, maze } = {}) => {
  const roomCode = room || payloadCode;
  if (code && roomCode && roomCode !== code) {
    return;
  }

  if (maze && maze.player) {
    updatePlayer(maze.player);
    handleGoal(player.x === goal.x && player.y === goal.y);
  }
});

navigationSocket.on('mazeState', ({ room, code: payloadCode, player: position, goalReached } = {}) => {
  const roomCode = room || payloadCode;
  if (code && roomCode && roomCode !== code) {
    return;
  }

  if (!position) {
    return;
  }

  updatePlayer(position);
  handleGoal(Boolean(goalReached));
});
