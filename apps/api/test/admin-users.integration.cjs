require('reflect-metadata');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { createRequire } = require('node:module');
const { after, before, test } = require('node:test');
const { setTimeout: delay } = require('node:timers/promises');
const { NestFactory } = require('@nestjs/core');
const { argon2id, hash } = require('argon2');
const { AppModule } = require('../dist/app.module');
const { DatabaseService } = require('../dist/database/database.service');
const { configureHttp } = require('../dist/http');

const database = new DatabaseService();
const origin = 'https://fashioncommerce.example.test';
const password = randomBytes(24).toString('hex');
let app;
let db;
let sql;
let base;
let passwordHash;
let operator;
let otherAdmin;
let customer;
let web;
let native;
let admin;

before(async () => {
  const url = new URL(process.env.DATABASE_URL ?? '');
  assert.equal(url.protocol, 'mysql:');
  assert.equal(url.hostname, '127.0.0.1');
  assert.match(url.pathname, /^\/fashioncommerce_[a-z0-9_]+_test$/);
  assert(url.port && !['3306', '3307'].includes(url.port), 'Use a test port');
  process.env.AUTH_WEB_ORIGIN = origin;
  db = database.client;
  assert.equal(await db.user.count(), 0, 'Use a freshly migrated database');
  const requireFromAdapter = createRequire(
    require.resolve('@prisma/adapter-mariadb'),
  );
  sql = await requireFromAdapter('mariadb').createConnection({
    host: url.hostname,
    port: Number(url.port),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
  });
  passwordHash = await hash(password, { type: argon2id });
  operator = await createUser('operator', 'ADMIN');
  otherAdmin = await createUser('other-admin', 'ADMIN');
  customer = await createUser('customer');
  app = await NestFactory.create(AppModule, {
    logger: false,
    abortOnError: false,
  });
  configureHttp(app);
  await app.listen(0, '127.0.0.1');
  base = (await app.getUrl()) + '/api/v1';
  [admin, web, native] = await Promise.all([
    login(operator, 'web'),
    login(customer, 'web'),
    login(customer),
  ]);
});

after(async () => {
  await Promise.all([app?.close(), database.onModuleDestroy(), sql?.end()]);
});

function createUser(label, role = 'CUSTOMER', status = 'ACTIVE') {
  return db.user.create({
    data: { email: `m607-${label}@example.test`, passwordHash, role, status },
  });
}

function send(path, { method = 'GET', headers = {}, body } = {}) {
  return fetch(base + path, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function requestLogin(user, channel = 'native') {
  return send(channel === 'web' ? '/auth/web/login' : '/auth/login', {
    method: 'POST',
    headers: channel === 'web' ? { Origin: origin } : {},
    body: { email: user.email, password },
  });
}

async function login(user, channel) {
  const response = await requestLogin(user, channel);
  const data = await expectStatus(response, 200);
  if (channel !== 'web') return { Authorization: `Bearer ${data.token}` };
  const cookie = response.headers.get('set-cookie')?.split(';')[0];
  assert.match(cookie, /^__Host-session=/);
  return { Cookie: cookie, Origin: origin, 'X-CSRF-Token': data.csrfToken };
}

function patch(id, body, headers = admin) {
  return send(`/admin/users/${id}/status`, { method: 'PATCH', body, headers });
}

async function expectStatus(response, status) {
  const body = await response.json();
  assert.equal(response.status, status, body.code);
  return body;
}

async function expectError(response, status, code) {
  assert.equal((await expectStatus(response, status)).code, code);
}

function accountAudits(user) {
  return db.adminAuditLog.findMany({
    where: {
      action: 'SET_ACCOUNT_STATUS',
      targetType: 'USER',
      targetId: user.id,
    },
    orderBy: { id: 'asc' },
  });
}

function sessions(user) {
  return db.session.findMany({
    where: { userId: user.id },
    orderBy: { id: 'asc' },
  });
}

test('Admin Web lists only Customers with a stable filtered page and contract fields', async () => {
  const disabledA = await createUser('disabled-a', 'CUSTOMER', 'DISABLED');
  const disabledB = await createUser('disabled-b', 'CUSTOMER', 'DISABLED');
  const path = '/admin/users?status=DISABLED&pageSize=1';
  for (const [index, user] of [disabledB, disabledA].entries()) {
    const page = index + 1;
    const response = await send(`${path}&page=${page}`, {
      headers: { Cookie: admin.Cookie },
    });
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await expectStatus(response, 200), {
      items: [
        {
          id: String(user.id),
          email: user.email,
          role: 'CUSTOMER',
          status: 'DISABLED',
        },
      ],
      page,
      pageSize: 1,
      total: 2,
    });
  }
  const active = await expectStatus(
    await send('/admin/users?status=ACTIVE', { headers: admin }),
    200,
  );
  assert.deepEqual(
    active.items.map(({ id }) => id),
    [String(customer.id)],
  );
  const all = await expectStatus(
    await send('/admin/users', { headers: admin }),
    200,
  );
  assert.deepEqual(
    all.items.map(({ id }) => id),
    [disabledB, disabledA, customer].map(({ id }) => String(id)),
  );
  await expectError(
    await send('/admin/users', { headers: web }),
    403,
    'FORBIDDEN',
  );
  await expectError(await send('/admin/users'), 401, 'UNAUTHENTICATED');
  for (const query of ['status=disabled', 'pageSize=101', 'role=ADMIN']) {
    await expectError(
      await send(`/admin/users?${query}`, { headers: admin }),
      400,
      'VALIDATION_ERROR',
    );
  }
});

test('status changes reject unauthenticated callers, wrong channel, CSRF, and role escalation', async () => {
  const disabled = { status: 'DISABLED' };
  await expectError(
    await patch(customer.id, disabled, {}),
    401,
    'UNAUTHENTICATED',
  );
  for (const headers of [
    web,
    native,
    { ...admin, Origin: 'https://other.example.test' },
  ]) {
    await expectError(
      await patch(customer.id, disabled, headers),
      403,
      'FORBIDDEN',
    );
  }
  for (const token of [undefined, web['X-CSRF-Token']]) {
    await expectError(
      await patch(customer.id, disabled, {
        Cookie: admin.Cookie,
        Origin: origin,
        ...(token && { 'X-CSRF-Token': token }),
      }),
      403,
      'CSRF_INVALID',
    );
  }
  for (const body of [
    { ...disabled, role: 'ADMIN' },
    { status: 'ADMIN' },
    {},
    { status: null },
  ]) {
    await expectError(await patch(customer.id, body), 400, 'VALIDATION_ERROR');
  }
  for (const id of [
    'invalid',
    '01',
    '18446744073709551616',
    '18446744073709551615',
  ]) {
    await expectError(await patch(id, disabled), 404, 'NOT_FOUND');
  }
  for (const user of [operator, otherAdmin]) {
    await expectError(
      await patch(user.id, disabled),
      409,
      'ACCOUNT_STATUS_CONFLICT',
    );
    assert.deepEqual(
      await db.user.findUniqueOrThrow({ where: { id: user.id } }),
      user,
    );
    assert.deepEqual(await accountAudits(user), []);
  }
  assert.deepEqual(
    await db.user.findUniqueOrThrow({ where: { id: customer.id } }),
    customer,
  );
  assert.deepEqual(await accountAudits(customer), []);
});

test('disable revokes Android and Web sessions, and enable keeps old credentials revoked', async () => {
  const originalSessions = await sessions(customer);
  assert.equal(originalSessions.length, 2);
  assert(originalSessions.every(({ revokedAt }) => revokedAt === null));
  const hidden = await expectStatus(
    await patch(customer.id, { status: 'DISABLED' }),
    200,
  );
  assert.deepEqual(hidden, {
    id: String(customer.id),
    email: customer.email,
    role: 'CUSTOMER',
    status: 'DISABLED',
  });
  const revoked = await sessions(customer);
  assert(revoked.every(({ revokedAt }) => revokedAt instanceof Date));
  assert.deepEqual(
    revoked.map(({ revokedAt, ...session }) => session),
    originalSessions.map(({ revokedAt, ...session }) => session),
  );
  assert.deepEqual(
    await expectStatus(await patch(customer.id, { status: 'DISABLED' }), 200),
    hidden,
  );
  assert.deepEqual(await sessions(customer), revoked);
  for (const headers of [web, native]) {
    await expectError(await send('/me', { headers }), 401, 'UNAUTHENTICATED');
  }
  await expectError(await requestLogin(customer), 401, 'INVALID_CREDENTIALS');

  const active = await expectStatus(
    await patch(customer.id, { status: 'ACTIVE' }),
    200,
  );
  assert.deepEqual(active, { ...hidden, status: 'ACTIVE' });
  assert.deepEqual(
    await expectStatus(await patch(customer.id, { status: 'ACTIVE' }), 200),
    active,
  );
  for (const headers of [web, native]) {
    await expectError(await send('/me', { headers }), 401, 'UNAUTHENTICATED');
  }
  const fresh = await login(customer, 'web');
  assert.deepEqual(
    await expectStatus(await send('/me', { headers: fresh }), 200),
    active,
  );
  const audits = await accountAudits(customer);
  assert.deepEqual(
    audits.map(({ metadata }) => metadata),
    [
      { previousStatus: 'ACTIVE', status: 'DISABLED' },
      { previousStatus: 'DISABLED', status: 'ACTIVE' },
    ],
  );
  assert(
    audits.every(
      ({ actorUserId, createdAt }) =>
        actorUserId === operator.id && createdAt instanceof Date,
    ),
  );
  assert.deepEqual(
    await db.user.findUniqueOrThrow({ where: { id: customer.id } }),
    customer,
  );
});

// Chờ đủ request cạnh tranh khóa dòng trên InnoDB trước khi nhả khóa test.
async function waitForUserLockWaiters(count) {
  const timeout = Date.now() + 3000;
  do {
    const [row] = await sql.query(`
      SELECT COUNT(DISTINCT w.REQUESTING_THREAD_ID) AS waiting
      FROM performance_schema.data_lock_waits w
      JOIN performance_schema.data_locks dl
        ON dl.ENGINE_LOCK_ID = w.REQUESTING_ENGINE_LOCK_ID
      WHERE dl.OBJECT_SCHEMA = DATABASE()
        AND dl.OBJECT_NAME = 'users' AND dl.INDEX_NAME = 'PRIMARY'
    `);
    if (Number(row.waiting) >= count) return;
    await delay(10);
  } while (Date.now() < timeout);
  assert.fail(`Expected ${count} requests waiting for the user row lock`);
}

async function raceOnUser(user, first, second) {
  const requests = [];
  await sql.beginTransaction();
  try {
    await sql.query('SELECT id FROM users WHERE id = ? FOR UPDATE', [user.id]);
    requests.push(first());
    await waitForUserLockWaiters(1);
    requests.push(second());
    await waitForUserLockWaiters(2);
  } finally {
    await sql.rollback();
    await Promise.allSettled(requests);
  }
  return Promise.all(requests);
}

test('two concurrent disables both return the same account and write one audit', async () => {
  const target = await createUser('repeated');
  const disable = () => patch(target.id, { status: 'DISABLED' });
  const [first, second] = await raceOnUser(target, disable, disable);
  const account = await expectStatus(first, 200);
  assert.equal(account.status, 'DISABLED');
  assert.deepEqual(await expectStatus(second, 200), account);
  assert.equal((await accountAudits(target)).length, 1);
});

test('disable and login serialize in both orders without leaving any reusable session', async () => {
  const disableFirst = await createUser('disable-first');
  const [disabled, refused] = await raceOnUser(
    disableFirst,
    () => patch(disableFirst.id, { status: 'DISABLED' }),
    () => requestLogin(disableFirst),
  );
  await expectStatus(disabled, 200);
  await expectError(refused, 401, 'INVALID_CREDENTIALS');
  assert.deepEqual(await sessions(disableFirst), []);

  const loginFirst = await createUser('login-first');
  const [signedIn, locked] = await raceOnUser(
    loginFirst,
    () => requestLogin(loginFirst, 'web'),
    () => patch(loginFirst.id, { status: 'DISABLED' }),
  );
  await expectStatus(signedIn, 200);
  await expectStatus(locked, 200);
  const cookie = signedIn.headers.get('set-cookie')?.split(';')[0];
  assert.match(cookie, /^__Host-session=/);
  const issued = await sessions(loginFirst);
  assert.equal(issued.length, 1);
  assert(issued[0].revokedAt instanceof Date);
  await expectStatus(await patch(loginFirst.id, { status: 'ACTIVE' }), 200);
  await expectError(
    await send('/me', { headers: { Cookie: cookie } }),
    401,
    'UNAUTHENTICATED',
  );
});

test('failure while revoking sessions or writing audit rolls back the whole disable', async () => {
  const target = await createUser('rollback');
  const bearer = await login(target);
  const originalSessions = await sessions(target);

  for (const [table, action] of [
    ['sessions', 'UPDATE'],
    ['admin_audit_logs', 'INSERT'],
  ]) {
    await sql.query(`
      CREATE TRIGGER m607_reject_write BEFORE ${action} ON ${table} FOR EACH ROW
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'M6-07 forced rollback'
    `);
    try {
      await expectError(
        await patch(target.id, { status: 'DISABLED' }),
        500,
        'INTERNAL_ERROR',
      );
      assert.deepEqual(
        await db.user.findUniqueOrThrow({ where: { id: target.id } }),
        target,
      );
      assert.deepEqual(await sessions(target), originalSessions);
      assert.deepEqual(await accountAudits(target), []);
      const profile = await expectStatus(
        await send('/me', { headers: bearer }),
        200,
      );
      assert.equal(profile.status, 'ACTIVE');
    } finally {
      await sql.query('DROP TRIGGER m607_reject_write');
    }
  }
});
