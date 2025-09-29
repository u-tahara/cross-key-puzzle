'use strict';

const MAZE_CONFIGS = {
  '1': {
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
  },
  '2': {
    width: 6,
    height: 6,
    goal: { x: 5, y: 5 },
    start: { x: 0, y: 0 },
    map: [
      [0, 0, 0, 1, 0, 0],
      [1, 1, 0, 1, 0, 1],
      [0, 0, 0, 0, 0, 0],
      [0, 1, 1, 1, 1, 0],
      [0, 0, 0, 0, 1, 0],
      [1, 1, 1, 0, 0, 0],
    ],
  },
};

const DEFAULT_MAZE_KEY = '1';

const resolveMazeConfigKey = (problem) => {
  const key = String(problem || '').trim();
  return Object.prototype.hasOwnProperty.call(MAZE_CONFIGS, key) ? key : DEFAULT_MAZE_KEY;
};

const getMazeConfig = (problemOrKey) => {
  const key = resolveMazeConfigKey(problemOrKey);
  return MAZE_CONFIGS[key];
};

const createInitialMazeState = (config = getMazeConfig(DEFAULT_MAZE_KEY)) => ({
  player: { ...config.start },
});

const canMoveOnMaze = (config, x, y) => (
  x >= 0
  && x < config.width
  && y >= 0
  && y < config.height
  && config.map[y][x] === 0
);

const applyMazeMove = (mazeState, direction, config) => {
  if (!mazeState || !mazeState.player) return { moved: false };

  let newX = mazeState.player.x;
  let newY = mazeState.player.y;

  if (direction === 'up') newY -= 1;
  if (direction === 'down') newY += 1;
  if (direction === 'left') newX -= 1;
  if (direction === 'right') newX += 1;

  if (!canMoveOnMaze(config, newX, newY)) {
    return { moved: false };
  }

  mazeState.player = { x: newX, y: newY };

  const goalReached = (newX === config.goal.x) && (newY === config.goal.y);

  return { moved: true, goalReached };
};

module.exports = {
  MAZE_CONFIGS,
  DEFAULT_MAZE_KEY,
  resolveMazeConfigKey,
  getMazeConfig,
  createInitialMazeState,
  canMoveOnMaze,
  applyMazeMove,
};
