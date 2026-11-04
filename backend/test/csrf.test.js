import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/attendly_test';
process.env.JWT_SECRET = 'this-is-a-test-secret-at-least-32-chars-long!!';
process.env.FRONTEND_ORIGINS = 'http://localhost:3000,https://attendly-app.netlify.app';
process.env.COOKIE_SECURE = 'false';
process.env.COOKIE_SAME_SITE = 'lax';

const { generateCsrfToken, verifyCsrfToken, csrfProtection, CSRF_COOKIE_NAME, CSRF_HEADER_NAME } = await import('../src/middleware/csrf.js');

test('CSRF Token generation and verification', async (t) => {
  await t.test('generates valid token that passes verification', () => {
    const token = generateCsrfToken();
    assert.equal(typeof token, 'string');
    assert.equal(verifyCsrfToken(token), true);
  });

  await t.test('rejects tampered token payload', () => {
    const token = generateCsrfToken();
    const parts = token.split('.');
    const tampered = `${parts[0]}.${parts[1]}ff.${parts[2]}`;
    assert.equal(verifyCsrfToken(tampered), false);
  });

  await t.test('rejects tampered token signature', () => {
    const token = generateCsrfToken();
    const parts = token.split('.');
    const tampered = `${parts[0]}.${parts[1]}.${parts[2].slice(0, -2)}aa`;
    assert.equal(verifyCsrfToken(tampered), false);
  });

  await t.test('rejects empty, null, or malformed tokens', () => {
    assert.equal(verifyCsrfToken(''), false);
    assert.equal(verifyCsrfToken(null), false);
    assert.equal(verifyCsrfToken(undefined), false);
    assert.equal(verifyCsrfToken('invalid.token'), false);
    assert.equal(verifyCsrfToken('not.enough.parts.extra'), false);
  });

  await t.test('rejects expired tokens', async () => {
    // 3 hours ago
    const threeHoursAgo = (Date.now() - 3 * 60 * 60 * 1000).toString(36);
    const crypto = await import('node:crypto');
    const payload = `${threeHoursAgo}.abcdef1234567890`;
    const hmac = crypto.createHmac('sha256', process.env.JWT_SECRET).update(payload).digest('hex');
    const expiredToken = `${payload}.${hmac}`;
    assert.equal(verifyCsrfToken(expiredToken), false);
  });
});

test('CSRF Protection Middleware', async (t) => {
  await t.test('allows GET and HEAD requests without CSRF token', () => {
    let nextCalledGet = false;
    const reqGet = { method: 'GET', headers: {} };
    csrfProtection(reqGet, {}, (err) => {
      assert.ifError(err);
      nextCalledGet = true;
    });
    assert.equal(nextCalledGet, true);

    let nextCalledHead = false;
    const reqHead = { method: 'HEAD', headers: {} };
    csrfProtection(reqHead, {}, (err) => {
      assert.ifError(err);
      nextCalledHead = true;
    });
    assert.equal(nextCalledHead, true);
  });

  await t.test('blocks POST request with missing CSRF token', () => {
    const req = { method: 'POST', headers: {} };
    csrfProtection(req, {}, (err) => {
      assert.ok(err);
      assert.equal(err.status, 403);
      assert.equal(err.code, 'CSRF_MISSING');
    });
  });

  await t.test('blocks POST request with missing header token but present cookie', () => {
    const token = generateCsrfToken();
    const req = {
      method: 'POST',
      headers: {
        cookie: `${CSRF_COOKIE_NAME}=${token}`
      }
    };
    csrfProtection(req, {}, (err) => {
      assert.ok(err);
      assert.equal(err.status, 403);
      assert.equal(err.code, 'CSRF_MISSING');
    });
  });

  await t.test('blocks POST request with missing cookie but present header token', () => {
    const token = generateCsrfToken();
    const req = {
      method: 'POST',
      headers: {
        [CSRF_HEADER_NAME]: token
      }
    };
    csrfProtection(req, {}, (err) => {
      assert.ok(err);
      assert.equal(err.status, 403);
      assert.equal(err.code, 'CSRF_MISSING');
    });
  });

  await t.test('blocks POST request with mismatched header and cookie token', () => {
    const token1 = generateCsrfToken();
    const token2 = generateCsrfToken();
    const req = {
      method: 'POST',
      headers: {
        [CSRF_HEADER_NAME]: token1,
        cookie: `${CSRF_COOKIE_NAME}=${token2}`
      }
    };
    csrfProtection(req, {}, (err) => {
      assert.ok(err);
      assert.equal(err.status, 403);
      assert.equal(err.code, 'CSRF_INVALID');
    });
  });

  await t.test('blocks POST request from disallowed Origin', () => {
    const token = generateCsrfToken();
    const req = {
      method: 'POST',
      headers: {
        origin: 'https://evil-attacker.com',
        [CSRF_HEADER_NAME]: token,
        cookie: `${CSRF_COOKIE_NAME}=${token}`
      }
    };
    csrfProtection(req, {}, (err) => {
      assert.ok(err);
      assert.equal(err.status, 403);
      assert.equal(err.code, 'FORBIDDEN');
    });
  });

  await t.test('allows POST request with valid token and matching allowed Origin', () => {
    const token = generateCsrfToken();
    const req = {
      method: 'POST',
      headers: {
        origin: 'https://attendly-app.netlify.app',
        [CSRF_HEADER_NAME]: token,
        cookie: `${CSRF_COOKIE_NAME}=${token}`
      }
    };
    let nextCalled = false;
    csrfProtection(req, {}, (err) => {
      assert.ifError(err);
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
  });

  await t.test('protects PUT, PATCH, and DELETE methods', () => {
    for (const method of ['PUT', 'PATCH', 'DELETE']) {
      const req = { method, headers: {} };
      csrfProtection(req, {}, (err) => {
        assert.ok(err);
        assert.equal(err.status, 403);
        assert.equal(err.code, 'CSRF_MISSING');
      });
    }
  });
});
