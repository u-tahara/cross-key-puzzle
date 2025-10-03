const mazeContainer = document.getElementById('maze');
const code = new URLSearchParams(window.location.search).get('code');
const mainElement = document.querySelector('main');

const normalizeString = (value) => (typeof value === 'string' ? value.trim() : '');

const buildDestination = (baseUrl, codeValue) => {
  const url = normalizeString(baseUrl);
  if (!url) return '';
  const trimmedCode = normalizeString(codeValue);
  if (!trimmedCode) {
    return url;
  }
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}code=${encodeURIComponent(trimmedCode)}`;
};

const fallbackSuccessUrl = 'pc-clear.html';
let successUrl = normalizeString(mainElement?.dataset?.successUrl) || fallbackSuccessUrl;

const createSuccessNavigator = () =>
  (window.PasswordSuccess?.createSuccessNavigator
    ? window.PasswordSuccess.createSuccessNavigator({
        successUrl,
        code,
        location: window.location,
      })
    : null);

let successNavigator = createSuccessNavigator();
let hasNavigatedToSuccessPage = false;

const updateSuccessDestination = (nextUrl) => {
  const normalized = normalizeString(nextUrl);
  if (!normalized || normalized === successUrl) {
    return;
  }
  successUrl = normalized;
  successNavigator = createSuccessNavigator();
};

const navigateToSuccessPage = () => {
  if (hasNavigatedToSuccessPage) {
    return;
  }

  if (
    successNavigator &&
    typeof successNavigator.navigate === 'function' &&
    successNavigator.navigate()
  ) {
    hasNavigatedToSuccessPage = true;
    return;
  }

  const destination = buildDestination(successUrl, code);
  if (!destination) {
    return;
  }

  hasNavigatedToSuccessPage = true;
  window.location.replace(destination);
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

  const stateKey = { page: 'pc-gyro' };

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

navigationSocket.on('navigateBack', ({ room, code: payloadCode } = {}) => {
  const roomCode = room || payloadCode;
  if (!roomCode || roomCode !== code) return;
  goBackToProblem();
});

const crossKeyMazeNamespace = window.CrossKeyMaze;

const getDefaultMazeConfigKey = () => {
  if (crossKeyMazeNamespace && typeof crossKeyMazeNamespace.DEFAULT_MAZE_KEY === 'string') {
    return crossKeyMazeNamespace.DEFAULT_MAZE_KEY.trim() || '1';
  }
  return '1';
};

const fallbackConfigKey = getDefaultMazeConfigKey();
const fallbackConfigFromNamespace = (() => {
  try {
    if (crossKeyMazeNamespace && typeof crossKeyMazeNamespace.getMazeConfig === 'function') {
      return crossKeyMazeNamespace.getMazeConfig(fallbackConfigKey);
    }
  } catch (error) {
    // ignore namespace lookup errors and use the hard-coded fallback
  }
  return null;
})();

const fallbackConfig = fallbackConfigFromNamespace || {
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

const getConfigFromNamespace = (key) => {
  const sanitizedKey = typeof key === 'string' ? key.trim() : '';
  if (!sanitizedKey) {
    return null;
  }

  const namespace = window.CrossKeyMaze;
  if (!namespace || typeof namespace.getMazeConfig !== 'function') {
    return null;
  }

  try {
    const config = namespace.getMazeConfig(sanitizedKey);
    return config || null;
  } catch (error) {
    return null;
  }
};

let currentConfigKey = fallbackConfigKey;
let usingFallbackMazeConfig = true;
let width = Number(fallbackConfig.width) || 0;
let height = Number(fallbackConfig.height) || 0;
const goal = {
  x: Number(fallbackConfig.goal?.x) || 0,
  y: Number(fallbackConfig.goal?.y) || 0,
};
let mazeMap = Array.isArray(fallbackConfig.map) ? fallbackConfig.map : [];
const player = {
  x: Number(fallbackConfig.start?.x) || 0,
  y: Number(fallbackConfig.start?.y) || 0,
};
let hasNotifiedProblemSolved = false;

const applyDestinations = (destinations) => {
  if (!destinations || typeof destinations !== 'object') {
    return;
  }

  const candidate = normalizeString(destinations.pc);
  if (candidate) {
    updateSuccessDestination(candidate);
  }
};

const notifyProblemSolved = () => {
  if (!code || hasNotifiedProblemSolved) {
    return;
  }

  hasNotifiedProblemSolved = true;
  navigationSocket.emit('problemSolved', { room: code, role: 'pc' });
};

function drawMaze() {
  if (!mazeContainer) {
    return;
  }

  const mazeWidth = Number.isFinite(width) && width > 0 ? width : fallbackConfig.width;
  const mazeHeight = Number.isFinite(height) && height > 0 ? height : fallbackConfig.height;

  mazeContainer.style.setProperty('--maze-width', String(mazeWidth));
  mazeContainer.innerHTML = '';
  for (let y = 0; y < mazeHeight; y += 1) {
    const row = Array.isArray(mazeMap[y]) ? mazeMap[y] : [];
    for (let x = 0; x < mazeWidth; x += 1) {
      const div = document.createElement('div');
      div.classList.add('cell');
      if (row[x] === 1) div.classList.add('wall');
      if (x === player.x && y === player.y) div.classList.add('player');
      if (x === goal.x && y === goal.y) div.classList.add('goal');
      mazeContainer.appendChild(div);
    }
  }
}

const applyMazeConfig = (config = fallbackConfig, { resetPlayer = false, usingFallback = false } = {}) => {
  if (!config) {
    return;
  }

  width = Number(config.width) || fallbackConfig.width;
  height = Number(config.height) || fallbackConfig.height;
  mazeMap = Array.isArray(config.map) ? config.map : fallbackConfig.map;

  usingFallbackMazeConfig = Boolean(usingFallback);

  const goalX = Number(config.goal?.x);
  const goalY = Number(config.goal?.y);
  goal.x = Number.isFinite(goalX) ? goalX : fallbackConfig.goal.x;
  goal.y = Number.isFinite(goalY) ? goalY : fallbackConfig.goal.y;

  if (resetPlayer || !Number.isFinite(player.x) || !Number.isFinite(player.y)) {
    const startX = Number(config.start?.x);
    const startY = Number(config.start?.y);
    player.x = Number.isFinite(startX) ? startX : fallbackConfig.start.x;
    player.y = Number.isFinite(startY) ? startY : fallbackConfig.start.y;
  }

  hasNavigatedToSuccessPage = false;
  drawMaze();
};

const updateMazeConfigByKey = (key) => {
  const sanitizedKey = typeof key === 'string' ? key.trim() : '';
  if (!sanitizedKey) {
    return false;
  }

  const config = getConfigFromNamespace(sanitizedKey);
  const shouldReapply = sanitizedKey !== currentConfigKey || usingFallbackMazeConfig;

  if (!config) {
    if (sanitizedKey !== currentConfigKey) {
      currentConfigKey = sanitizedKey;
      applyMazeConfig(fallbackConfig, { resetPlayer: true, usingFallback: true });
    }
    return false;
  }

  currentConfigKey = sanitizedKey;
  if (shouldReapply) {
    applyMazeConfig(config, { resetPlayer: true, usingFallback: false });
  }
  return true;
};

const initialConfigFromNamespace = fallbackConfigFromNamespace || getConfigFromNamespace(fallbackConfigKey);
const initialConfig = initialConfigFromNamespace || fallbackConfig;
applyMazeConfig(initialConfig, { resetPlayer: true, usingFallback: !initialConfigFromNamespace });

const updateGoal = (position = {}, { shouldRedraw = true } = {}) => {
  const x = Number(position.x);
  const y = Number(position.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return false;
  }

  const changed = goal.x !== x || goal.y !== y;
  goal.x = x;
  goal.y = y;
  if (changed && shouldRedraw) {
    drawMaze();
  }
  return changed;
};
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
  if (goalReached) {
    if (!hasNavigatedToSuccessPage) {
      notifyProblemSolved();
      navigateToSuccessPage();
    }
    return;
  }

  hasNavigatedToSuccessPage = false;
};

navigationSocket.on(
  'status',
  ({ room, code: payloadCode, maze, mazeConfigKey, problem, goal: payloadGoal, destinations } = {}) => {
    const roomCode = room || payloadCode;
    if (code && roomCode && roomCode !== code) {
      return;
    }

    applyDestinations(destinations);
    const incomingKey = mazeConfigKey || problem;
    const configUpdated = incomingKey ? updateMazeConfigByKey(incomingKey) : false;

  let goalChanged = false;
  if (!configUpdated && payloadGoal) {
    goalChanged = updateGoal(payloadGoal, { shouldRedraw: false });
  }

  if (maze && maze.player) {
    updatePlayer(maze.player);
    handleGoal(player.x === goal.x && player.y === goal.y);
  } else if (goalChanged) {
    drawMaze();
  }
  },
);

navigationSocket.on(
  'mazeState',
  ({ room, code: payloadCode, player: position, goalReached, goal: payloadGoal, mazeConfigKey, destinations } = {}) => {
    const roomCode = room || payloadCode;
    if (code && roomCode && roomCode !== code) {
      return;
    }

    applyDestinations(destinations);
    if (mazeConfigKey) {
      updateMazeConfigByKey(mazeConfigKey);
    }

  if (payloadGoal) {
    updateGoal(payloadGoal, { shouldRedraw: false });
  }

  if (position) {
    updatePlayer(position);
    handleGoal(Boolean(goalReached));
  } else {
    drawMaze();
  }
  },
);

navigationSocket.on('problemSolved', ({ room, code: payloadCode, destinations } = {}) => {
  const roomCode = room || payloadCode;
  if (!roomCode || (code && roomCode !== code)) {
    return;
  }

  applyDestinations(destinations);
  hasNotifiedProblemSolved = true;
  navigateToSuccessPage();
});

const backButton = document.querySelector('.back-button');

if (backButton) {
  backButton.addEventListener('click', (event) => {
    event.preventDefault();
    notifyBackNavigation();
    goBackToProblem();
  });
}
