const { test } = require('node:test');
const assert = require('node:assert/strict');

const { createSuccessNavigator } = require('../js/password-success.js');

const createMockLocation = () => {
  const calls = [];
  return {
    calls,
    replace(url) {
      calls.push(url);
    },
  };
};

test('navigate encodes the code and only navigates once', () => {
  const location = createMockLocation();
  const navigator = createSuccessNavigator({
    successUrl: 'mobile-next.html',
    code: 'A B',
    location,
  });

  const firstResult = navigator.navigate();
  assert.equal(firstResult, true);
  assert.deepEqual(location.calls, ['mobile-next.html?code=A%20B']);
  assert.equal(navigator.hasNavigated(), true);

  const secondResult = navigator.navigate();
  assert.equal(secondResult, false);
  assert.deepEqual(location.calls, ['mobile-next.html?code=A%20B']);
});

test('getDestination returns base url when code missing', () => {
  const navigator = createSuccessNavigator({
    successUrl: 'mobile-next.html',
    location: createMockLocation(),
  });

  assert.equal(navigator.getDestination(), 'mobile-next.html');
});

test('navigate returns false when success url is missing', () => {
  const location = createMockLocation();
  const navigator = createSuccessNavigator({
    successUrl: '  ',
    code: 'ABC',
    location,
  });

  const result = navigator.navigate();
  assert.equal(result, false);
  assert.deepEqual(location.calls, []);
  assert.equal(navigator.hasNavigated(), false);
});
