const DEFAULT_THRESHOLD = 0.35;

function clampAudioLevel(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 0;
  if (number >= 1) return 1;
  return number;
}

function createAudioState() {
  return {
    level: 0,
    peak: 0,
    thresholdReached: false,
  };
}

function updateAudioState(state = createAudioState(), level, options = {}) {
  const threshold = Number.isFinite(options.threshold) ? options.threshold : DEFAULT_THRESHOLD;
  const clamped = clampAudioLevel(level);
  const peak = Math.max(state.peak || 0, clamped);
  const thresholdReached = Boolean(state.thresholdReached || peak >= threshold);
  return {
    level: clamped,
    peak,
    thresholdReached,
  };
}

function calculateRmsFromTimeDomain(data) {
  if (!data || typeof data.length !== 'number' || data.length === 0) {
    return 0;
  }
  let sum = 0;
  for (let i = 0; i < data.length; i += 1) {
    const sample = (Number(data[i]) - 128) / 128;
    sum += sample * sample;
  }
  return Math.sqrt(sum / data.length);
}

const api = Object.freeze({
  clampAudioLevel,
  createAudioState,
  updateAudioState,
  calculateRmsFromTimeDomain,
  DEFAULT_THRESHOLD,
});

if (typeof globalThis !== 'undefined') {
  globalThis.Problem5AudioState = api;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = api;
}
