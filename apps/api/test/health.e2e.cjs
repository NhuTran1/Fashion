const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { createServer } = require('node:net');
const { resolve } = require('node:path');
const { test } = require('node:test');
const { setTimeout: delay } = require('node:timers/promises');

async function reserveTestPort() {
  const reservation = createServer().listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const { port } = reservation.address();
  await new Promise((done) => reservation.close(done));
  return port;
}

test(
  'real API process serves health on the configured port',
  { timeout: 15000 },
  async () => {
    const port = await reserveTestPort();
    const child = spawn(
      process.execPath,
      [resolve(__dirname, '../dist/main.js')],
      {
        env: { ...process.env, APP_HOST: '127.0.0.1', APP_PORT: String(port) },
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    );

    let diagnostics = '';
    let spawnError;
    const closed = new Promise((done) => {
      child.once('error', (error) => {
        spawnError = error;
      });
      child.once('close', done);
    });
    child.stderr.setEncoding('utf8').on('data', (data) => {
      diagnostics += data;
    });

    try {
      const url = 'http://127.0.0.1:' + port + '/api/v1/health';
      const deadline = Date.now() + 10000;
      let response;
      while (!spawnError && child.exitCode === null && Date.now() < deadline) {
        try {
          response = await fetch(url, { signal: AbortSignal.timeout(500) });
          break;
        } catch {
          await delay(100);
        }
      }
      assert.ifError(spawnError);
      assert(
        response && child.exitCode === null,
        diagnostics || 'API did not start.',
      );
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { status: 'ok' });
    } finally {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill();
      }
      await closed;
    }
  },
);
