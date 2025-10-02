const { test } = require('node:test');
const assert = require('node:assert/strict');

const shake = require('../js/problem6-shake-state.js');

test('calculateAccelerationMagnitude returns euclidean norm', () => {
  const magnitude = shake.calculateAccelerationMagnitude(3, 4, 0);
  assert.equal(magnitude, 5);
});

test('updateShakeState increments count respecting interval', () => {
  const initial = shake.createShakeState();
  const first = shake.updateShakeState(initial, shake.DEFAULT_THRESHOLD + 1, { now: 0 });
  assert.equal(first.count, 1);
  assert.equal(first.incremented, true);

  const suppressed = shake.updateShakeState(first, shake.DEFAULT_THRESHOLD + 5, { now: 100 });
  assert.equal(suppressed.count, 1);
  assert.equal(suppressed.incremented, false);

  const second = shake.updateShakeState(first, shake.DEFAULT_THRESHOLD + 5, { now: 500 });
  assert.equal(second.count, 2);
  assert.equal(second.incremented, true);
});

