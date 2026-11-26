const assert = require('node:assert/strict');
const { test } = require('node:test');
const { hasUserRole } = require('../dist/users/user-role.policy');

test('active customers and admins get only their assigned role', () => {
  for (const role of ['CUSTOMER', 'ADMIN']) {
    const user = { role, status: 'ACTIVE' };
    assert.equal(hasUserRole(user, 'CUSTOMER'), role === 'CUSTOMER');
    assert.equal(hasUserRole(user, 'ADMIN'), role === 'ADMIN');
  }
});

test('disabled and unauthenticated callers get no role', () => {
  assert.equal(
    hasUserRole({ role: 'ADMIN', status: 'DISABLED' }, 'ADMIN'),
    false,
  );
  assert.equal(
    hasUserRole({ role: 'CUSTOMER', status: 'DISABLED' }, 'CUSTOMER'),
    false,
  );
  assert.equal(hasUserRole(null, 'ADMIN'), false);
  assert.equal(hasUserRole(undefined, 'CUSTOMER'), false);
});

test('rejects Staff, unknown and non-canonical role or status values', () => {
  for (const role of ['STAFF', 'SELLER', 'admin', 'ADMIN ', '']) {
    assert.equal(hasUserRole({ role, status: 'ACTIVE' }, 'ADMIN'), false);
    assert.equal(hasUserRole({ role, status: 'ACTIVE' }, role), false);
  }
  for (const status of ['BLOCKED', 'active', 'ACTIVE ', '']) {
    assert.equal(hasUserRole({ role: 'ADMIN', status }, 'ADMIN'), false);
  }
});
