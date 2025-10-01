const { test } = require('node:test');
const assert = require('node:assert');

const { detectNavigationWsEndpoint } = require('../js/navigation-endpoint.js');

test('returns production endpoint when hostname is u-tahara.jp', () => {
  const endpoint = detectNavigationWsEndpoint({
    protocol: 'https:',
    hostname: 'u-tahara.jp',
    port: '',
  });
  assert.strictEqual(endpoint, 'https://ws.u-tahara.jp');
});

test('returns same-origin slash for localhost', () => {
  const endpoint = detectNavigationWsEndpoint({
    protocol: 'http:',
    hostname: 'localhost',
    port: '3000',
  });
  assert.strictEqual(endpoint, '/');
});

test('returns slash for private network ip', () => {
  const endpoint = detectNavigationWsEndpoint({
    protocol: 'http:',
    hostname: '192.168.1.23',
    port: '8080',
  });
  assert.strictEqual(endpoint, '/');
});

test('returns same origin when already on websocket host', () => {
  const endpoint = detectNavigationWsEndpoint({
    protocol: 'https:',
    hostname: 'ws.u-tahara.jp',
    port: '',
    origin: 'https://ws.u-tahara.jp',
  });
  assert.strictEqual(endpoint, 'https://ws.u-tahara.jp');
});

test('falls back to default when hostname missing', () => {
  const endpoint = detectNavigationWsEndpoint({});
  assert.strictEqual(endpoint, 'https://ws.u-tahara.jp');
});
