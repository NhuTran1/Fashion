require('reflect-metadata');
const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const { createHash, randomBytes } = require('node:crypto');
const { after, before, test } = require('node:test');
const { promisify } = require('node:util');
const { NestFactory } = require('@nestjs/core');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');
const { verify } = require('argon2');
const { AppModule } = require('../dist/app.module');
const { configureHttp } = require('../dist/http');
const { PrismaClient } = require('../dist/generated/prisma/client');

const origin = 'https://fashioncommerce.example.test';
const customerEmail = 'customer-m302@example.test';
const adminEmail = 'demo-admin@example.test';
const password = randomBytes(24).toString('hex');
const wrongPassword = randomBytes(24).toString('hex');
const exec = promisify(execFile);
const logs = [];
const secrets = [password, wrongPassword];
let app;
let db;
let backend;

before(async () => {
  const address = new URL(process.env.DATABASE_URL ?? '');
  assert.equal(address.protocol, 'mysql:');
  assert.equal(address.hostname, '127.0.0.1');
  assert.match(address.pathname, /^\/fashioncommerce_[a-z0-9_]+_test$/);
  assert(
    address.port && !['3306', '3307'].includes(address.port),
    'Use an isolated test port',
  );
  process.env.AUTH_WEB_ORIGIN = origin;
  const adapter = new PrismaMariaDb({
    host: address.hostname,
    port: Number(address.port),
    user: decodeURIComponent(address.username),
    password: decodeURIComponent(address.password),
    database: address.pathname.slice(1),
    connectionLimit: 2,
  });
  db = new PrismaClient({ adapter });
  assert.equal(
    await db.user.count(),
    0,
    'Use a freshly migrated test database',
  );
  app = await startAuthApp();
  backend = await app.getUrl();
});

after(async () => {
  try {
    await app?.close();
  } finally {
    await db?.$disconnect();
  }
  for (const secret of secrets) {
    assert(
      logs.every((line) => !line.includes(secret)),
      'Credential leaked in NestJS logs',
    );
  }
});

// Mỗi app test có bộ đếm login riêng và dùng cùng logger kiểm tra lộ credential.
async function startAuthApp() {
  const logger = Object.fromEntries(
    ['log', 'error', 'warn', 'debug', 'verbose', 'fatal'].map((level) => [
      level,
      (...values) => logs.push(values.map(String).join(' ')),
    ]),
  );
  const authApp = await NestFactory.create(AppModule, {
    logger,
    abortOnError: false,
  });
  configureHttp(authApp);
  await authApp.listen(0, '127.0.0.1');
  return authApp;
}

function post(path, body, headers = {}) {
  return fetch(backend + '/api/v1/auth/' + path, {
    method: 'POST',
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

// Mô phỏng request đọc CSRF từ Web hoặc một client HTTP.
function readCsrf(headers = {}) {
  return fetch(backend + '/api/v1/auth/csrf', { headers });
}

function credentials(email = customerEmail, pwd = password) {
  return { email, password: pwd };
}

// Chạy đúng entry point mà lệnh db:seed gọi sau bước build.
function runSeed(adminPassword = password) {
  return exec(process.execPath, [require.resolve('../dist/seed.js')], {
    env: {
      ...process.env,
      SEED_ADMIN_PASSWORD: adminPassword,
      SEED_CUSTOMER_PASSWORD: wrongPassword,
    },
  });
}

function tokenHash(token) {
  return createHash('sha256').update(token).digest('hex');
}

// Kiểm tra định dạng lỗi và bảo đảm response lỗi không chứa bí mật đã dùng.
async function expectError(response, status, code) {
  assert.equal(response.status, status);
  const body = await response.json();
  assert.equal(body.code, code);
  assert(body.requestId);
  assert.equal(response.headers.get('x-request-id'), body.requestId);
  const serialized = JSON.stringify(body);
  assert(
    secrets.every((secret) => !serialized.includes(secret)),
    'Credential leaked in API error response',
  );
  return body;
}

async function webLogin(email = customerEmail) {
  const response = await post('web/login', credentials(email), {
    Origin: origin,
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const attributes = response.headers.get('set-cookie');
  assert.match(attributes, /^__Host-session=web_/);
  assert.match(attributes, /; Path=\/; HttpOnly; Secure; SameSite=Lax/);
  assert.doesNotMatch(attributes, /Domain=/i);
  const cookie = attributes.split(';')[0];
  const token = cookie.slice('__Host-session='.length);
  const body = await response.json();
  assert.deepEqual(Object.keys(body).sort(), [
    'csrfToken',
    'expiresAt',
    'user',
  ]);
  assert(!JSON.stringify(body).includes(token));
  assert(!JSON.stringify(body).includes(password));
  secrets.push(token, body.csrfToken);
  return { cookie, token, ...body };
}

test('register normalizes email, fixes Customer role and stores only an Argon2id hash', async () => {
  const response = await post(
    'register',
    credentials(customerEmail.toUpperCase()),
  );
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.deepEqual(body, {
    id: body.id,
    email: customerEmail,
    role: 'CUSTOMER',
    status: 'ACTIVE',
  });
  assert.match(body.id, /^[0-9]+$/);
  const saved = await db.user.findUniqueOrThrow({
    where: { email: customerEmail },
  });
  assert(saved.passwordHash.startsWith('$argon2id$'));
  assert(await verify(saved.passwordHash, password));
  secrets.push(saved.passwordHash);
  assert.equal(await db.session.count(), 0);

  await expectError(
    await post('register', credentials()),
    409,
    'EMAIL_ALREADY_EXISTS',
  );
  await expectError(
    await post('register', {
      ...credentials('escalation@example.test'),
      role: 'ADMIN',
    }),
    400,
    'VALIDATION_ERROR',
  );
  await expectError(
    await post('register', credentials('web@example.test'), {
      Origin: 'https://wrong.example.test',
    }),
    403,
    'INVALID_ORIGIN',
  );
  assert.equal(await db.user.count(), 1);
  const webSignup = await post('register', credentials('web@example.test'), {
    Origin: origin,
  });
  assert.equal(webSignup.status, 201);
  assert.equal((await webSignup.json()).role, 'CUSTOMER');
});

test('native sessions store token digests, revoke only the requested session and reject replay or expiry', async () => {
  await expectError(
    await post('login', credentials(), { Origin: origin }),
    403,
    'INVALID_ORIGIN',
  );
  const response = await post('login', credentials());
  const another = await post('login', credentials());
  assert.equal(response.status, 200);
  assert.equal(another.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const first = await response.json();
  const second = await another.json();
  assert.deepEqual(Object.keys(first).sort(), ['expiresAt', 'token', 'user']);
  assert.equal(first.user.role, 'CUSTOMER');
  assert(!JSON.stringify(first).includes(password));
  assert.notEqual(first.token, second.token);
  secrets.push(first.token, second.token);
  const firstHash = tokenHash(first.token);
  const secondHash = tokenHash(second.token);
  const stored = await db.session.findUniqueOrThrow({
    where: { tokenHash: firstHash },
  });
  assert.equal(
    stored.expiresAt.getTime() - stored.createdAt.getTime(),
    7 * 24 * 3600 * 1000,
  );
  assert.equal(
    await db.session.count({ where: { tokenHash: first.token } }),
    0,
  );
  const firstHeader = { Authorization: 'Bearer ' + first.token };
  assert.equal((await post('logout', undefined, firstHeader)).status, 204);
  assert(
    (await db.session.findUniqueOrThrow({ where: { tokenHash: firstHash } }))
      .revokedAt,
  );
  assert.equal(
    (await db.session.findUniqueOrThrow({ where: { tokenHash: secondHash } }))
      .revokedAt,
    null,
  );
  await expectError(
    await post('logout', undefined, firstHeader),
    401,
    'UNAUTHENTICATED',
  );
  await db.session.update({
    where: { tokenHash: secondHash },
    data: { expiresAt: new Date(0) },
  });
  await expectError(
    await post('logout', undefined, {
      Authorization: 'Bearer ' + second.token,
    }),
    401,
    'UNAUTHENTICATED',
  );
});

test('web Origin, Secure cookie and session-bound CSRF protect logout', async () => {
  await expectError(
    await post('web/login', credentials()),
    403,
    'INVALID_ORIGIN',
  );
  process.env.AUTH_WEB_ORIGIN = 'null';
  try {
    await expectError(
      await post('web/login', credentials(), { Origin: 'null' }),
      403,
      'INVALID_ORIGIN',
    );
  } finally {
    process.env.AUTH_WEB_ORIGIN = origin;
  }
  const first = await webLogin();
  const second = await webLogin();
  const headers = { Cookie: first.cookie, Origin: origin };
  await expectError(
    await post('logout', undefined, headers),
    403,
    'CSRF_INVALID',
  );
  await expectError(
    await post('logout', undefined, {
      ...headers,
      'X-CSRF-Token': second.csrfToken,
    }),
    403,
    'CSRF_INVALID',
  );
  await expectError(
    await post('logout', undefined, {
      Cookie: first.cookie,
      Origin: 'https://wrong.example.test',
      'X-CSRF-Token': first.csrfToken,
    }),
    403,
    'FORBIDDEN',
  );
  await expectError(
    await post('logout', undefined, { Authorization: 'Bearer ' + first.token }),
    401,
    'UNAUTHENTICATED',
  );
  assert.equal(
    (
      await db.session.findUniqueOrThrow({
        where: { tokenHash: tokenHash(first.token) },
      })
    ).revokedAt,
    null,
  );
  const response = await post('logout', undefined, {
    ...headers,
    'X-CSRF-Token': first.csrfToken,
  });
  assert.equal(response.status, 204);
  assert.match(
    response.headers.get('set-cookie'),
    /^__Host-session=; Max-Age=0;/,
  );
  await expectError(
    await post('logout', undefined, {
      ...headers,
      'X-CSRF-Token': first.csrfToken,
    }),
    401,
    'UNAUTHENTICATED',
  );
});

test('web CSRF reload only reads an active cookie session and rejects cross-origin requests', async () => {
  const session = await webLogin();
  const key = { where: { tokenHash: tokenHash(session.token) } };
  const original = await db.session.findUniqueOrThrow(key);
  assert.equal(
    await db.session.count({ where: { tokenHash: session.token } }),
    0,
  );

  const headers = { Cookie: session.cookie, 'Sec-Fetch-Site': 'same-origin' };
  const response = await readCsrf(headers);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.has('access-control-allow-origin'), false);
  assert.equal(response.headers.has('set-cookie'), false);
  const body = await response.json();
  assert.deepEqual(Object.keys(body), ['csrfToken']);
  assert(body.csrfToken === session.csrfToken);
  assert.deepEqual(await db.session.findUniqueOrThrow(key), original);

  await expectError(await readCsrf(), 401, 'UNAUTHENTICATED');
  await expectError(
    await readCsrf({ Authorization: 'Bearer ' + session.token }),
    401,
    'UNAUTHENTICATED',
  );
  await expectError(
    await readCsrf({ ...headers, Origin: 'https://wrong.example.test' }),
    403,
    'INVALID_ORIGIN',
  );
  await expectError(
    await readCsrf({ ...headers, 'Sec-Fetch-Site': 'same-site' }),
    403,
    'INVALID_ORIGIN',
  );

  const user = { where: { email: customerEmail } };
  await db.user.update({ ...user, data: { status: 'DISABLED' } });
  try {
    await expectError(await readCsrf(headers), 401, 'UNAUTHENTICATED');
  } finally {
    await db.user.update({ ...user, data: { status: 'ACTIVE' } });
  }

  await db.session.update({ ...key, data: { expiresAt: new Date(0) } });
  await expectError(await readCsrf(headers), 401, 'UNAUTHENTICATED');
  await db.session.update({ ...key, data: { expiresAt: original.expiresAt } });

  const logout = await post('logout', undefined, {
    ...headers,
    Origin: origin,
    'X-CSRF-Token': session.csrfToken,
  });
  assert.equal(logout.status, 204);
  await expectError(await readCsrf(headers), 401, 'UNAUTHENTICATED');
});

test('invalid credentials stay generic and disabled customers cannot log in', async () => {
  const unknown = await expectError(
    await post('login', credentials('unknown@example.test')),
    401,
    'INVALID_CREDENTIALS',
  );
  const wrong = await expectError(
    await post('login', credentials(customerEmail, wrongPassword)),
    401,
    'INVALID_CREDENTIALS',
  );
  assert.equal(unknown.message, wrong.message);
  await db.user.update({
    where: { email: customerEmail },
    data: { status: 'DISABLED' },
  });
  const disabled = await expectError(
    await post('login', credentials()),
    401,
    'INVALID_CREDENTIALS',
  );
  assert.equal(unknown.message, disabled.message);
});

test('local seed rejects a Customer at the demo Admin email and preserves Admin on rerun', async () => {
  const registered = await post('register', credentials(adminEmail));
  assert.equal(registered.status, 201);
  assert.equal((await registered.json()).role, 'CUSTOMER');

  const where = { email: adminEmail };
  const customer = await db.user.findUniqueOrThrow({ where });
  await assert.rejects(runSeed(), (error) => {
    assert.equal(error.code, 1);
    assert.match(
      error.stderr,
      /Demo admin email belongs to an account without the ADMIN role/,
    );
    assert(
      secrets.every(
        (secret) => !(error.stdout + error.stderr).includes(secret),
      ),
    );
    return true;
  });
  const conflicting = await db.user.findUniqueOrThrow({ where });
  assert.equal(conflicting.role, 'CUSTOMER');
  assert.equal(conflicting.status, customer.status);
  assert(conflicting.passwordHash === customer.passwordHash);
  assert.equal(
    await db.user.count({ where: { email: 'demo-customer@example.test' } }),
    0,
  );
  assert.equal(await db.category.count({ where: { slug: 'demo-ao' } }), 0);

  await db.user.update({
    where,
    data: { email: 'seed-collision@example.test' },
  });
  await runSeed();
  const admin = await db.user.findUniqueOrThrow({ where });
  assert.equal(admin.role, 'ADMIN');
  assert.equal(admin.status, 'ACTIVE');
  assert(admin.passwordHash.startsWith('$argon2id$'));
  assert(await verify(admin.passwordHash, password));

  const alternative = randomBytes(24).toString('hex');
  secrets.push(alternative);
  await db.user.update({ where, data: { status: 'DISABLED' } });
  try {
    await runSeed(alternative);
    const rerun = await db.user.findUniqueOrThrow({ where });
    assert.equal(rerun.id, admin.id);
    assert.equal(rerun.role, 'ADMIN');
    assert.equal(rerun.status, 'DISABLED');
    assert(rerun.passwordHash === admin.passwordHash);
  } finally {
    await db.user.update({ where, data: { status: 'ACTIVE' } });
  }
});

test('seeded Admin signs in only on Web and uses the shorter session', async () => {
  await expectError(
    await post('register', credentials(adminEmail)),
    409,
    'EMAIL_ALREADY_EXISTS',
  );
  await expectError(
    await post('login', credentials(adminEmail)),
    403,
    'FORBIDDEN',
  );
  const session = await webLogin(adminEmail);
  assert.equal(session.user.role, 'ADMIN');
  const tokenDigest = tokenHash(session.token);
  const stored = await db.session.findUniqueOrThrow({
    where: { tokenHash: tokenDigest },
  });
  assert.equal(
    stored.expiresAt.getTime() - stored.createdAt.getTime(),
    8 * 3600 * 1000,
  );
  await db.session.update({
    where: { tokenHash: tokenDigest },
    data: { lastSeenAt: new Date(Date.now() - 31 * 60000) },
  });
  await expectError(
    await post('logout', undefined, {
      Origin: origin,
      Cookie: session.cookie,
      'X-CSRF-Token': session.csrfToken,
    }),
    401,
    'UNAUTHENTICATED',
  );
  await expectError(
    await readCsrf({ Cookie: session.cookie }),
    401,
    'UNAUTHENTICATED',
  );
  await db.session.update({
    where: { tokenHash: tokenDigest },
    data: { lastSeenAt: new Date(), expiresAt: new Date(0) },
  });
  await expectError(
    await readCsrf({ Cookie: session.cookie }),
    401,
    'UNAUTHENTICATED',
  );
});

test('login limit shares the same IP bucket across Android and Web', async () => {
  const before = await db.session.count();
  let limited = false;
  for (let attempt = 0; attempt < 11; attempt++) {
    const response = await post(
      'web/login',
      credentials(adminEmail, wrongPassword),
      { Origin: origin },
    );
    if (response.status === 429) {
      await expectError(response, 429, 'RATE_LIMITED');
      limited = true;
      break;
    }
    await expectError(response, 401, 'INVALID_CREDENTIALS');
  }
  assert(limited);
  await expectError(
    await post('login', credentials(adminEmail)),
    429,
    'RATE_LIMITED',
  );
  assert.equal(await db.session.count(), before);
});

test('profile and addresses enforce active sessions, CSRF and address ownership', async () => {
  const meApp = await startAuthApp();
  try {
    const base = (await meApp.getUrl()) + '/api/v1';
    const send = (path, method = 'GET', headers = {}, body) =>
      fetch(base + path, {
        method,
        headers: {
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });

    const emailA = 'customer-m305-a@example.test';
    const emailB = 'customer-m305-b@example.test';
    for (const email of [emailA, emailB]) {
      assert.equal(
        (await send('/auth/register', 'POST', {}, credentials(email))).status,
        201,
      );
    }

    const nativeLogin = await send(
      '/auth/login',
      'POST',
      {},
      credentials(emailA),
    );
    assert.equal(nativeLogin.status, 200);
    const { token: nativeToken, user: userA } = await nativeLogin.json();
    secrets.push(nativeToken);
    const bearerA = { Authorization: 'Bearer ' + nativeToken };

    const webAuth = async (email) => {
      const response = await send(
        '/auth/web/login',
        'POST',
        { Origin: origin },
        credentials(email),
      );
      assert.equal(response.status, 200);
      const cookie = response.headers.get('set-cookie').split(';')[0];
      const { user, csrfToken } = await response.json();
      secrets.push(cookie.slice('__Host-session='.length), csrfToken);
      return { user, headers: { Cookie: cookie, Origin: origin }, csrfToken };
    };

    const webB = await webAuth(emailB);
    const webAdmin = await webAuth(adminEmail);
    await expectError(await send('/me'), 401, 'UNAUTHENTICATED');
    for (const [headers, user] of [
      [bearerA, userA],
      [webB.headers, webB.user],
      [webAdmin.headers, webAdmin.user],
    ]) {
      const profile = await send('/me', 'GET', headers);
      assert.equal(profile.status, 200);
      assert.equal(profile.headers.get('cache-control'), 'no-store');
      assert.deepEqual(await profile.json(), user);
    }

    const addressA = {
      name: 'Customer Demo A',
      phone: '0000000001',
      addressText: 'Địa chỉ thử nghiệm A',
    };
    const addressB = {
      name: 'Customer Demo B',
      phone: '0000000002',
      addressText: 'Địa chỉ thử nghiệm B',
      isDefault: true,
    };
    const addresses = '/me/addresses';
    await expectError(
      await send(addresses, 'GET', webAdmin.headers),
      403,
      'FORBIDDEN',
    );
    await expectError(
      await send(addresses, 'POST', webB.headers, addressB),
      403,
      'CSRF_INVALID',
    );
    await expectError(
      await send(addresses, 'POST', bearerA, {
        ...addressA,
        userId: webB.user.id,
      }),
      400,
      'VALIDATION_ERROR',
    );

    const createdA = await send(addresses, 'POST', bearerA, addressA);
    const createdB = await send(
      addresses,
      'POST',
      { ...webB.headers, 'X-CSRF-Token': webB.csrfToken },
      addressB,
    );
    assert.equal(createdA.status, 201);
    assert.equal(createdB.status, 201);
    const own = await createdA.json();
    const foreign = await createdB.json();
    assert.match(own.id, /^[1-9][0-9]*$/);
    assert.deepEqual(own, { id: own.id, ...addressA, isDefault: false });
    assert.deepEqual(foreign, { id: foreign.id, ...addressB });

    const otherId = addresses + '/' + foreign.id;
    const ownId = addresses + '/' + own.id;
    const cross = await expectError(
      await send(otherId, 'PATCH', bearerA, { name: 'Thay đổi trái quyền' }),
      404,
      'NOT_FOUND',
    );
    const missing = await expectError(
      await send(addresses + '/18446744073709551615', 'PATCH', bearerA, {
        name: 'Địa chỉ thiếu',
      }),
      404,
      'NOT_FOUND',
    );
    assert.equal(cross.message, missing.message);
    await expectError(
      await send(addresses + '/18446744073709551616', 'PATCH', bearerA, {
        name: 'ID ngoài miền',
      }),
      400,
      'VALIDATION_ERROR',
    );
    await expectError(
      await send(ownId, 'PATCH', bearerA, {}),
      400,
      'VALIDATION_ERROR',
    );
    await expectError(
      await send(ownId, 'PATCH', bearerA, { phone: null }),
      400,
      'VALIDATION_ERROR',
    );

    const patched = await send(ownId, 'PATCH', bearerA, { isDefault: true });
    assert.equal(patched.status, 200);
    const updated = { ...own, isDefault: true };
    assert.deepEqual(await patched.json(), updated);
    for (const [headers, expected] of [
      [bearerA, updated],
      [webB.headers, foreign],
    ]) {
      const list = await send(addresses, 'GET', headers);
      assert.equal(list.status, 200);
      assert.deepEqual(await list.json(), [expected]);
    }

    await db.session.update({
      where: { tokenHash: tokenHash(nativeToken) },
      data: { expiresAt: new Date(0) },
    });
    await expectError(
      await send('/me', 'GET', bearerA),
      401,
      'UNAUTHENTICATED',
    );
  } finally {
    await meApp.close();
  }
});
