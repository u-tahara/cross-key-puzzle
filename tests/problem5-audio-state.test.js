const { test } = require('node:test');
const assert = require('node:assert/strict');

const audio = require('../js/problem5-audio-state.js');

test('clampAudioLevel keeps values between 0 and 1', () => {
  assert.equal(audio.clampAudioLevel(-0.5), 0);
  assert.equal(audio.clampAudioLevel(0), 0);
  assert.equal(audio.clampAudioLevel(0.25), 0.25);
  assert.equal(audio.clampAudioLevel(1.5), 1);
});

test('updateAudioState tracks peak and threshold flag', () => {
  const initial = audio.createAudioState();
  const first = audio.updateAudioState(initial, 0.2);
  assert.equal(first.level, 0.2);
  assert.equal(first.peak, 0.2);
  assert.equal(first.thresholdReached, false);

  const second = audio.updateAudioState(first, 0.5);
  assert.equal(second.level, 0.5);
  assert.equal(second.peak, 0.5);
  assert.equal(second.thresholdReached, true);
});

