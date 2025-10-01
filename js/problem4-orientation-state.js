const DIRECTION_KEYS = ['north', 'east', 'south', 'west'];

export const normalizeVisitedState = (value = {}) => {
  const result = { north: false, east: false, south: false, west: false };
  if (!value || typeof value !== 'object') {
    return result;
  }

  DIRECTION_KEYS.forEach((direction) => {
    result[direction] = Boolean(value[direction]);
  });

  return result;
};

export const mergeVisitedStates = (base, update) => {
  const normalizedBase = normalizeVisitedState(base);
  const normalizedUpdate = normalizeVisitedState(update);

  const result = { ...normalizedBase };
  DIRECTION_KEYS.forEach((direction) => {
    if (normalizedUpdate[direction]) {
      result[direction] = true;
    }
  });

  return result;
};

export const createVisitedSnapshot = (value) => ({
  ...normalizeVisitedState(value),
});

export const getDirectionKeys = () => [...DIRECTION_KEYS];

export default {
  normalizeVisitedState,
  mergeVisitedStates,
  createVisitedSnapshot,
  getDirectionKeys,
};
