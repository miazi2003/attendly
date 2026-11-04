import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/attendly_test';
process.env.JWT_SECRET = 'this-is-a-test-secret-at-least-32-chars-long!!';
process.env.FRONTEND_ORIGINS = 'http://localhost:3000,https://attendly-app.netlify.app';
process.env.COOKIE_SECURE = 'false';
process.env.COOKIE_SAME_SITE = 'lax';

const { authenticate } = await import('../src/middleware/auth.js');
const { institutionalToday, archiveCutoff, archiveStatus, toUtcDate } = await import('../src/utils/attendance.js');

test('Authentication Middleware - Expired or Invalid Cookies', async (t) => {
  await t.test('rejects request with missing auth cookie', async () => {
    const req = { headers: {} };
    let errorCaught = null;
    await authenticate(req, {}, (err) => { errorCaught = err; });
    assert.ok(errorCaught);
    assert.equal(errorCaught.status, 401);
    assert.equal(errorCaught.code, 'UNAUTHENTICATED');
  });

  await t.test('rejects request with expired JWT token', async () => {
    const expiredToken = jwt.sign(
      { role: 'TEACHER', exp: Math.floor(Date.now() / 1000) - 60 },
      process.env.JWT_SECRET,
      { subject: '507f1f77bcf86cd799439011' }
    );
    const req = {
      headers: {
        cookie: `attendly_auth=${expiredToken}`
      }
    };
    let errorCaught = null;
    await authenticate(req, {}, (err) => { errorCaught = err; });
    assert.ok(errorCaught);
    assert.equal(errorCaught.status, 401);
    assert.equal(errorCaught.code, 'UNAUTHENTICATED');
  });

  await t.test('rejects request with invalid signature JWT token', async () => {
    const invalidToken = jwt.sign(
      { role: 'TEACHER' },
      'wrong-secret-that-does-not-match-at-all-32-chars',
      { subject: '507f1f77bcf86cd799439011' }
    );
    const req = {
      headers: {
        cookie: `attendly_auth=${invalidToken}`
      }
    };
    let errorCaught = null;
    await authenticate(req, {}, (err) => { errorCaught = err; });
    assert.ok(errorCaught);
    assert.equal(errorCaught.status, 401);
    assert.equal(errorCaught.code, 'UNAUTHENTICATED');
  });
});

test('Attendance Archive & Timezone logic (Asia/Dhaka)', async (t) => {
  await t.test('archiveCutoff calculates 1st of previous month based on 0-indexed JS month', () => {
    // If date in Dhaka is 2026-11-04, month is 11 (November).
    // Date.UTC(year, month - 2, 1) passes monthIndex = 9 (October), which evaluates to 2026-10-01.
    const dateNov = new Date('2026-11-04T12:00:00Z');
    const cutoffNov = archiveCutoff(dateNov);
    assert.equal(cutoffNov.toISOString().slice(0, 10), '2026-10-01');

    // If month is January (month 1), e.g., 2026-01-15:
    // month === 1 ? Date.UTC(year - 1, 11, 1) => December 1 of previous year (2025-12-01)
    const dateJan = new Date('2026-01-15T12:00:00Z');
    const cutoffJan = archiveCutoff(dateJan);
    assert.equal(cutoffJan.toISOString().slice(0, 10), '2025-12-01');
  });

  await t.test('archiveStatus correctly classifies dates relative to cutoff', () => {
    const now = new Date('2026-11-04T12:00:00Z');
    // For November 2026, cutoff is 2026-10-01:
    // Active: dates >= 2026-10-01
    assert.equal(archiveStatus(toUtcDate('2026-11-01'), now), 'ACTIVE');
    assert.equal(archiveStatus(toUtcDate('2026-10-15'), now), 'ACTIVE');
    assert.equal(archiveStatus(toUtcDate('2026-10-01'), now), 'ACTIVE');

    // Archived: earlier than cutoff (before 2026-10-01)
    assert.equal(archiveStatus(toUtcDate('2026-09-30'), now), 'ARCHIVED');
    assert.equal(archiveStatus(toUtcDate('2026-08-31'), now), 'ARCHIVED');
    assert.equal(archiveStatus(toUtcDate('2026-06-01'), now), 'ARCHIVED');
    assert.equal(archiveStatus(toUtcDate('2025-12-01'), now), 'ARCHIVED');
  });

  await t.test('institutionalToday handles Asia/Dhaka midnight boundary', () => {
    // 2026-11-04T17:30:00Z is 2026-11-04 23:30 in Dhaka (+6)
    const beforeMidnight = new Date('2026-11-04T17:30:00.000Z');
    assert.equal(institutionalToday(beforeMidnight), '2026-11-04');

    // 2026-11-04T18:01:00Z is 2026-11-05 00:01 in Dhaka (+6)
    const afterMidnight = new Date('2026-11-04T18:01:00.000Z');
    assert.equal(institutionalToday(afterMidnight), '2026-11-05');
  });
});
