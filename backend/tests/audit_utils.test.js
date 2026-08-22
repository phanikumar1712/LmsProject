const test = require('node:test');
const assert = require('node:assert/strict');
const { parseDevice, clientIp, writeAudit } = require('../src/utils/audit');

test('parseDevice classifies common desktop browsers', () => {
    assert.deepEqual(parseDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'),
        { browser: 'Chrome', os: 'Windows', device: 'Desktop' });
    assert.deepEqual(parseDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'),
        { browser: 'Safari', os: 'macOS', device: 'Desktop' });
    assert.deepEqual(parseDevice('Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0'),
        { browser: 'Firefox', os: 'Linux', device: 'Desktop' });
    assert.deepEqual(parseDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'),
        { browser: 'Edge', os: 'Windows', device: 'Desktop' });
});

test('parseDevice classifies mobile devices', () => {
    const mobile = parseDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1');
    assert.equal(mobile.device, 'Mobile');
    assert.equal(mobile.os, 'iOS');
    assert.equal(mobile.browser, 'Safari');

    const android = parseDevice('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36');
    assert.equal(android.device, 'Mobile');
    assert.equal(android.os, 'Android');
    assert.equal(android.browser, 'Chrome');
});

test('parseDevice handles API clients and missing user agents', () => {
    const curl = parseDevice('curl/8.4.0');
    assert.equal(curl.browser, 'curl');
    assert.equal(curl.os, 'Unknown');

    const postman = parseDevice('PostmanRuntime/7.36.0');
    assert.equal(postman.browser, 'Postman');

    assert.deepEqual(parseDevice(''), { browser: 'Unknown', os: 'Unknown', device: 'Unknown' });
    assert.deepEqual(parseDevice(undefined), { browser: 'Unknown', os: 'Unknown', device: 'Unknown' });
});

test('clientIp prefers x-forwarded-for first hop and falls back to req.ip', () => {
    assert.equal(clientIp({ headers: { 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }, ip: '10.0.0.1' }), '203.0.113.7');
    assert.equal(clientIp({ headers: {}, ip: '127.0.0.1' }), '127.0.0.1');
    assert.equal(clientIp({ headers: {} }), null);
});

// ── writeAudit ───────────────────────────────────────────────────────────────
// The controller migrations (announcements/enrollments/departments/ratings)
// rely on writeAudit producing one INSERT with old/new values + IP + device.
const POOL_PATH = require.resolve('../src/db/pool');
let auditCalls = [];

require.cache[POOL_PATH] = {
    id: POOL_PATH,
    filename: POOL_PATH,
    loaded: true,
    exports: {
        query: async (sql, params) => { auditCalls.push({ sql, params }); return { rows: [] }; },
        pool: { connect: async () => { throw new Error('unexpected pool.connect'); } },
    },
};

test('writeAudit inserts one row with actor, old/new values, IP, and parsed device', async () => {
    auditCalls = [];
    const req = {
        user: { id: 'admin-1', name: 'CSE Admin' },
        ip: '203.0.113.7',
        headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
    };

    await writeAudit(req, {
        action: 'USER_STATUS_CHANGED',
        resource: 'users',
        resourceId: 'student-1',
        oldValue: { active: true },
        newValue: { active: false },
        details: { studentId: 'CSE102' },
    });

    assert.equal(auditCalls.length, 1);
    const { sql, params } = auditCalls[0];
    assert.ok(sql.includes('old_value'));
    assert.ok(sql.includes('new_value'));
    assert.ok(sql.includes('ip_address'));
    assert.ok(sql.includes('INSERT INTO audit_logs'));

    assert.equal(params[0], 'admin-1');   // actor
    assert.equal(params[1], 'USER_STATUS_CHANGED');
    assert.equal(params[2], 'users');
    assert.equal(params[3], 'student-1');

    const details = JSON.parse(params[4]);
    assert.equal(details.studentId, 'CSE102');
    assert.equal(details.device.browser, 'Chrome');
    assert.equal(details.device.os, 'Windows');
    assert.equal(details.device.device, 'Desktop');

    assert.deepEqual(JSON.parse(params[5]), { active: true });  // old_value
    assert.deepEqual(JSON.parse(params[6]), { active: false }); // new_value
    assert.equal(params[7], '203.0.113.7');                     // ip
});

test('writeAudit honors x-forwarded-for, tolerates missing values, and never throws', async () => {
    auditCalls = [];
    const req = {
        user: null, // system action
        ip: '10.0.0.1',
        headers: { 'x-forwarded-for': '198.51.100.9, 10.0.0.1', 'user-agent': 'curl/8.4.0' },
    };

    await writeAudit(req, { action: 'SYSTEM_JOB', resource: 'platform_settings', details: {} });
    assert.equal(auditCalls.length, 1);
    const { params } = auditCalls[0];
    assert.equal(params[0], null);        // no actor
    assert.equal(params[5], null);        // old_value omitted → NULL
    assert.equal(params[6], null);        // new_value omitted → NULL
    assert.equal(params[7], '198.51.100.9'); // x-forwarded-for first hop
    assert.equal(JSON.parse(params[4]).device.browser, 'curl');

    // A throwing pool must never propagate out of writeAudit.
    require.cache[POOL_PATH].exports.query = async () => { throw new Error('db down'); };
    await writeAudit(req, { action: 'SHOULD_NOT_THROW', resource: 'users' });
    assert.equal(auditCalls.length, 1); // no new call recorded — error swallowed
    require.cache[POOL_PATH].exports.query = async (sql, params) => { auditCalls.push({ sql, params }); return { rows: [] }; };
});

test('writeAudit requires an action and resource', async () => {
    auditCalls = [];
    await writeAudit({ user: { id: 'x' }, headers: {} }, { action: '', resource: 'users' });
    await writeAudit({ user: { id: 'x' }, headers: {} }, { action: 'NO_RESOURCE' });
    assert.equal(auditCalls.length, 0);
});

test.after(() => {
    delete require.cache[POOL_PATH];
});
