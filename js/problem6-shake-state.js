const DEFAULT_THRESHOLD = 18;
const DEFAULT_MIN_INTERVAL = 280;
const DEFAULT_REQUIRED = 8;

function calculateAccelerationMagnitude(x = 0, y = 0, z = 0) {
  const ax = Number(x) || 0;
  const ay = Number(y) || 0;
  const az = Number(z) || 0;
  return Math.sqrt(ax * ax + ay * ay + az * az);
}

function createShakeState() {
  return {
    count: 0,
    completed: false,
    lastShakeAt: 0,
  };
}

function updateShakeState(state = createShakeState(), magnitude, options = {}) {
  const threshold = Number.isFinite(options.threshold) ? options.threshold : DEFAULT_THRESHOLD;
  const minInterval = Number.isFinite(options.minInterval) ? options.minInterval : DEFAULT_MIN_INTERVAL;
  const required = Number.isFinite(options.required) ? options.required : DEFAULT_REQUIRED;
  const now = Number.isFinite(options.now) ? options.now : Date.now();

  const safeState = {
    count: Number(state.count) || 0,
    completed: Boolean(state.completed),
    lastShakeAt: Number(state.lastShakeAt) || 0,
  };

  let { count, completed, lastShakeAt } = safeState;
  let incremented = false;

  if (!completed && Number.isFinite(magnitude) && magnitude >= threshold) {
    const elapsed = now - lastShakeAt;
    const allowInitial = count <= 0 && lastShakeAt <= 0;
    if (allowInitial || elapsed >= minInterval) {
      count += 1;
      lastShakeAt = now;
      incremented = true;
    }
  }

  if (count >= required) {
    completed = true;
  }

  return {
    count,
    completed,
    lastShakeAt,
    threshold,
    minInterval,
    required,
    incremented,
  };
}

const api = Object.freeze({
  DEFAULT_THRESHOLD,
  DEFAULT_MIN_INTERVAL,
  DEFAULT_REQUIRED,
  calculateAccelerationMagnitude,
  createShakeState,
  updateShakeState,
});

if (typeof globalThis !== 'undefined') {
  globalThis.Problem6ShakeState = api;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = api;
}
