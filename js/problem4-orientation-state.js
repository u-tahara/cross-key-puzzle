const DIRECTION_KEYS = ['north', 'east', 'south', 'west'];

function getDirectionKeys() {
  return [...DIRECTION_KEYS];
}

function normalizeVisitedState(source) {
  const result = {};
  const input = source && typeof source === 'object' ? source : {};
  DIRECTION_KEYS.forEach((direction) => {
    result[direction] = Boolean(input[direction]);
  });
  return result;
}

function mergeVisitedStates(baseState, updates) {
  const base = normalizeVisitedState(baseState);
  const next = normalizeVisitedState(updates);
  const merged = {};
  DIRECTION_KEYS.forEach((direction) => {
    merged[direction] = base[direction] || next[direction];
  });
  return merged;
}

function createVisitedSnapshot(state) {
  return normalizeVisitedState(state);
}

const api = {
  getDirectionKeys,
  normalizeVisitedState,
  mergeVisitedStates,
  createVisitedSnapshot,
};

if (typeof globalThis !== 'undefined') {
  globalThis.Problem4OrientationState = api;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = api;
}

if (typeof exports !== 'undefined') {
  exports.getDirectionKeys = getDirectionKeys;
  exports.normalizeVisitedState = normalizeVisitedState;
  exports.mergeVisitedStates = mergeVisitedStates;
  exports.createVisitedSnapshot = createVisitedSnapshot;
}
