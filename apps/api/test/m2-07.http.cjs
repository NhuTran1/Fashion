require('reflect-metadata');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { resolve } = require('node:path');
const { after, before, test } = require('node:test');
const { Body, Controller, Get, Module, Post } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');
const { IsInt, Min } = require('class-validator');
const { AppModule } = require('../dist/app.module');
const { configureHttp } = require('../dist/http');

class ValidationProbeDto {}
IsInt()(ValidationProbeDto.prototype, 'quantity');
Min(1)(ValidationProbeDto.prototype, 'quantity');

// Route kiểm tra chỉ có trong module test.
class ValidationProbeController {
  create(dto) {
    assert(dto instanceof ValidationProbeDto);
    return { quantity: dto.quantity };
  }

  fail() {
    throw new Error('internal fixture detail');
  }
}
Controller('validation-probe')(ValidationProbeController);
const probe = ValidationProbeController.prototype;
Reflect.defineMetadata(
  'design:paramtypes',
  [ValidationProbeDto],
  probe,
  'create',
);
Post()(probe, 'create', Object.getOwnPropertyDescriptor(probe, 'create'));
Body()(probe, 'create', 0);
Get('failure')(probe, 'fail', Object.getOwnPropertyDescriptor(probe, 'fail'));

class HttpTestModule {}
Module({ imports: [AppModule], controllers: [ValidationProbeController] })(
  HttpTestModule,
);

let app;
let url;

before(async () => {
  app = await NestFactory.create(HttpTestModule, { logger: false });
  configureHttp(app);
  await app.listen(0, '127.0.0.1');
  url = await app.getUrl();
});

after(async () => {
  await app?.close();
});

async function expectError(response, status, code) {
  assert.equal(response.status, status);
  const body = await response.json();
  assert.deepEqual(Object.keys(body).sort(), ['code', 'message', 'requestId']);
  assert.equal(body.code, code);
  assert.equal(typeof body.message, 'string');
  assert(body.message.length > 0);
  assert.match(body.requestId, /^[0-9a-f-]{36}$/i);
  assert.equal(response.headers.get('x-request-id'), body.requestId);
  return body;
}

function submit(body) {
  return fetch(url + '/api/v1/validation-probe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
}

test('root smoke and versioned health return status ok', async () => {
  for (const path of ['/', '/api/v1/health']) {
    const response = await fetch(url + path);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok' });
  }
});

test('DTO accepts a valid request and transforms it to the DTO class', async () => {
  const response = await submit(JSON.stringify({ quantity: 2 }));
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { quantity: 2 });
});

test('validation rejects wrong types, missing and extra fields, and malformed JSON', async () => {
  const ids = new Set();
  for (const body of [
    '{"quantity":"2"}',
    '{}',
    '{"quantity":2,"extra":true}',
    '{"quantity":0}',
    '{"quantity":',
  ]) {
    const error = await expectError(
      await submit(body),
      400,
      'VALIDATION_ERROR',
    );
    ids.add(error.requestId);
  }
  assert.equal(ids.size, 5);
});

test('unknown routes use the error contract', async () => {
  await expectError(await fetch(url + '/api/v1/missing'), 404, 'NOT_FOUND');
});

test('unexpected errors hide internal details', async () => {
  const body = await expectError(
    await fetch(url + '/api/v1/validation-probe/failure'),
    500,
    'INTERNAL_ERROR',
  );
  assert(!body.message.includes('internal fixture detail'));
});

test('bootstrap rejects invalid APP_PORT', () => {
  const result = spawnSync(
    process.execPath,
    [resolve(__dirname, '../dist/main.js')],
    {
      env: { ...process.env, APP_HOST: '127.0.0.1', APP_PORT: 'not-a-port' },
      encoding: 'utf8',
      timeout: 5000,
    },
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /APP_PORT must be an integer from 1 to 65535/);
});
