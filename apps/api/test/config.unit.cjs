const assert = require('node:assert/strict');
const { test } = require('node:test');
const { parseApiConfig } = require('../dist/config');

test('uses loopback and port 3000 by default', () => {
  assert.deepEqual(parseApiConfig({}), { host: '127.0.0.1', port: 3000 });
});

test('accepts an explicit IP address and valid port', () => {
  assert.deepEqual(parseApiConfig({ APP_HOST: '::1', APP_PORT: '65535' }), {
    host: '::1',
    port: 65535,
  });
  assert.equal(parseApiConfig({ APP_PORT: '1' }).port, 1);
});

test('rejects invalid host and port values', () => {
  assert.throws(() => parseApiConfig({ APP_HOST: 'localhost' }), /APP_HOST/);
  for (const port of ['', '0', '65536', '-1', '1.5', '3e3', ' 3000', 'abc']) {
    assert.throws(() => parseApiConfig({ APP_PORT: port }), /APP_PORT/);
  }
});
