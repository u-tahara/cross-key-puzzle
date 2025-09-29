const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  getMazeConfig,
  createInitialMazeState,
  applyMazeMove,
  resolveMazeConfigKey,
  canMoveOnMaze,
} = require('../js/maze-logic.js');

test('maze config key resolves to default when unknown', () => {
  assert.strictEqual(resolveMazeConfigKey('999'), '1');
  assert.strictEqual(resolveMazeConfigKey('2'), '2');
});

test('cannot move through walls in maze 2', () => {
  const config = getMazeConfig('2');
  const maze = createInitialMazeState(config);

  const blockedLeft = applyMazeMove(maze, 'left', config);
  assert.deepStrictEqual(blockedLeft, { moved: false });
  assert.deepStrictEqual(maze.player, { x: 0, y: 0 });

  const firstStep = applyMazeMove(maze, 'right', config);
  assert.strictEqual(firstStep.moved, true);
  assert.deepStrictEqual(maze.player, { x: 1, y: 0 });

  const blockedDown = applyMazeMove(maze, 'down', config);
  assert.deepStrictEqual(blockedDown, { moved: false });
  assert.deepStrictEqual(maze.player, { x: 1, y: 0 });
});

test('canMoveOnMaze respects boundaries', () => {
  const config = getMazeConfig('1');
  assert.strictEqual(canMoveOnMaze(config, 0, 0), true);
  assert.strictEqual(canMoveOnMaze(config, -1, 0), false);
  assert.strictEqual(canMoveOnMaze(config, 0, 5), false);
});

test('goal detection triggers when reaching the goal', () => {
  const config = getMazeConfig('1');
  const maze = createInitialMazeState(config);

  // Move through an open path to reach the goal.
  const steps = ['down', 'down', 'right', 'right', 'down', 'down', 'right', 'right'];
  let result = { moved: false };
  for (const step of steps) {
    result = applyMazeMove(maze, step, config);
  }

  assert.strictEqual(result.moved, true);
  assert.strictEqual(result.goalReached, true);
  assert.deepStrictEqual(maze.player, { x: 4, y: 4 });
});
