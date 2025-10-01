const { test } = require('node:test');
const assert = require('node:assert/strict');

const loadModule = () => import('../js/problem4-orientation-state.js');

test('normalizeVisitedState coerces values into booleans for all directions', async () => {
  const { normalizeVisitedState, getDirectionKeys } = await loadModule();
  const result = normalizeVisitedState({
    north: 1,
    east: 'yes',
    south: null,
    west: undefined,
    extra: true,
  });

  getDirectionKeys().forEach((direction) => {
    assert.ok(Object.prototype.hasOwnProperty.call(result, direction));
  });

  assert.deepEqual(result, {
    north: true,
    east: true,
    south: false,
    west: false,
  });
});

test('mergeVisitedStates keeps previous true flags and adds new ones', async () => {
  const { mergeVisitedStates } = await loadModule();
  const base = { north: true, east: false, south: false, west: false };
  const update = { east: 1, west: 'true', north: 0 };

  const merged = mergeVisitedStates(base, update);

  assert.deepEqual(merged, {
    north: true,
    east: true,
    south: false,
    west: true,
  });
});

test('createVisitedSnapshot always returns a new normalized object', async () => {
  const { createVisitedSnapshot } = await loadModule();
  const source = { north: true, east: false, south: true, west: false };

  const snapshot = createVisitedSnapshot(source);

  assert.notStrictEqual(snapshot, source);
  assert.deepEqual(snapshot, source);

  snapshot.north = false;
  assert.strictEqual(source.north, true);
});
