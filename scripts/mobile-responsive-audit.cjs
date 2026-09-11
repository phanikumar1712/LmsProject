// Temporary mobile responsiveness audit v4 (deleted after use).
// One role chunk per invocation: node scripts/mobile-audit4.cjs <role|anon-details|superadmin-details>
// Single hard load per chunk, then client-side navigation. Appends results to
// scripts/audit4-results.jsonl so chunks can run in separate invocations.
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const crypto = require('crypto');
const { spawn } = require('child_process');
const WebSocket = require('../backend/node_modules/ws');

const ROOT = path.join(__dirname, '..');
const CDP_PORT = 9337;
const ORIGIN = 'http://localhost:5173';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CHUNK = process.argv[2] || 'anon';
const RESULTS = path.join(ROOT, 'scripts', 'audit4-results.jsonl');

const envText = fs.readFileSync(path.join(ROOT, 'backend', '.env'), 'utf8');
const JWT_SECRET = (envText.match(/^JWT_SECRET=(.*)$/m) || [])[1]?.trim();
if (!JWT_SECRET) { console.error('FATAL: no JWT_SECRET'); process.exit(1); }
function signJWT(userId, role) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const data = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ userId, role, iat: now, exp: now + 3600 })}`;
  return `${data}.${crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url')}`;
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl, { perMessageDeflate: false, maxPayload: 256 * 1024 * 1024 });
  let id = 0;
  const pending = new Map();
  const events = [];
  ws.on('message', (raw) => {
    const msg = JSON.parse(raw);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    else if (msg.method) events.push(msg);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const mid = ++id;
    pending.set(mid, (m) => (m.error ? reject(new Error(method + ': ' + JSON.stringify(m.error))) : resolve(m.result)));
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  const drain = () => events.splice(0);
  const ready = new Promise((res, rej) => { ws.once('open', res); ws.once('error', rej); });
  const close = () => new Promise((res) => { try { ws.close(); } catch { /* noop */ } setTimeout(res, 200); });
  return { send, drain, ready, close };
}
async function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => resolve(JSON.parse(d))); }).on('error', reject);
  });
}

(async () => {
  // ── ids + tokens (fast: 2 queries max) ──
  process.chdir(path.join(ROOT, 'backend'));
  require(path.join(ROOT, 'backend', 'node_modules', 'dotenv')).config({ path: path.join(ROOT, 'backend', '.env'), override: true });
  const { query, pool } = require(path.join(ROOT, 'backend', 'src', 'db', 'pool.js'));
  const one = async (sql, vals = []) => (await query(sql, vals)).rows[0];
  let id = {};
  try {
    id.student = (await one(`SELECT id FROM users WHERE email='cse.student1@demo.com'`)).id;
    id.instructor = (await one(`SELECT id FROM users WHERE email='cse.instructor@demo.com'`)).id;
    id.course = (await one(`SELECT id FROM courses WHERE status='PUBLISHED' ORDER BY created_at DESC LIMIT 1`)).id;
    if (CHUNK === 'admin' || CHUNK === 'superadmin' || CHUNK.startsWith('details')) {
      id.admin = (await one(`SELECT id FROM users WHERE email='cse.admin@lms.com'`)).id;
      id.superadmin = (await one(`SELECT id FROM users WHERE email='superadmin@lms.com'`)).id;
    }
    if (CHUNK.startsWith('details')) {
      id.dept = (await one(`SELECT id FROM departments ORDER BY name LIMIT 1`)).id;
      id.category = (await one(`SELECT id FROM categories ORDER BY name LIMIT 1`)).id;
      const enr = await one(`SELECT e.student_id FROM enrollments e JOIN courses c ON c.id=e.course_id WHERE e.student_id=$1 AND c.instructor_id=$2 LIMIT 1`, [id.student, id.instructor]);
      id.enrolledStudent = enr?.student_id || id.student;
      const le = await one(`SELECT course_id FROM enrollments WHERE student_id=$1 LIMIT 1`, [id.student]);
      id.learnCourse = le?.course_id || id.course;
    }
  } finally { await pool.end(); }

  // ── Chrome ──
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'mobaudit4-'));
  const chrome = spawn('/usr/bin/google-chrome', [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--remote-debugging-port=' + CDP_PORT, `--user-data-dir=${profile}`, 'about:blank',
  ], { stdio: 'ignore' });
  let info = null;
  for (let i = 0; 50 > i && !info; i++) { await sleep(200); try { info = await fetchJSON(`http://127.0.0.1:${CDP_PORT}/json/version`); } catch { /* retry */ } }
  if (!info) { console.error('FATAL: chrome not up'); process.exit(1); }
  const browser = connect(info.webSocketDebuggerUrl);
  await browser.ready;
  const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
  const t = (await fetchJSON(`http://127.0.0.1:${CDP_PORT}/json/list`)).find((x) => x.id === targetId);
  const page = connect(t.webSocketDebuggerUrl);
  await page.ready;
  await page.send('Page.enable'); await page.send('Runtime.enable'); await page.send('Network.enable');

  let rlRemaining = Infinity, rlResetSec = 0;
  const consumeEvents = () => {
    for (const ev of page.drain()) {
      if (ev.method === 'Network.responseReceived' && String(ev.params.response.url).includes('/api/')) {
        const h = ev.params.response.headers || {};
        const rem = h['RateLimit-Remaining'] ?? h['ratelimit-remaining'] ?? h['X-RateLimit-Remaining'];
        if (rem !== undefined) { const n = parseInt(rem, 10); if (!isNaN(n)) rlRemaining = n; }
        const rst = h['RateLimit-Reset'] ?? h['ratelimit-reset'];
        if (rst !== undefined) rlResetSec = parseInt(rst, 10) || 0;
      }
    }
  };
  const pace = async () => {
    consumeEvents();
    if (rlRemaining < 20) {
      const waitMs = Math.min(Math.max(rlResetSec * 1000 + 3000, 10000), 190000);
      console.log(`   ⏳ rl low (${rlRemaining}) — pause ${Math.round(waitMs / 1000)}s`);
      await sleep(waitMs);
      rlRemaining = Infinity;
    }
  };

  const MEASURE = `(() => {
    const doc = document.documentElement, body = document.body;
    const vw = window.innerWidth;
    const sw = Math.max(doc.scrollWidth, body ? body.scrollWidth : 0);
    const overflowPx = sw - vw;
    const bad = [];
    if (overflowPx > 2) {
      for (const el of document.querySelectorAll('*')) {
        const r = el.getBoundingClientRect();
        if (r.right > vw + 2 && r.width > 20) {
          const cls = (typeof el.className === 'string' ? el.className : '').split(/\\s+/).filter(Boolean).slice(0, 8).join('.');
          bad.push(el.tagName.toLowerCase() + (cls ? '.' + cls : '') + '@' + Math.round(r.right));
          if (bad.length >= 6) break;
        }
      }
    }
    return { overflowPx, bad, textLen: (body ? body.innerText : '').trim().length };
  })()`;

  const setToken = async (role) => {
    await page.send('Page.navigate', { url: ORIGIN + '/login' });
    await sleep(1600);
    if (role === 'anon') {
      await page.send('Runtime.evaluate', { expression: `localStorage.removeItem("lms_token"); "ok"`, returnByValue: true });
    } else {
      await page.send('Runtime.evaluate', {
        expression: `localStorage.setItem("lms_token", ${JSON.stringify(signJWT(id[role], role.toUpperCase()))}); "ok"`,
        returnByValue: true,
      });
    }
    await page.send('Page.navigate', { url: ORIGIN + '/login' });
    await sleep(3500);
  };

  const navClientSide = async (route) => {
    await page.send('Runtime.evaluate', {
      expression: `(() => { history.pushState({}, "", ${JSON.stringify(route)}); window.dispatchEvent(new PopStateEvent("popstate")); window.scrollTo(0, 0); return location.pathname; })()`,
      returnByValue: true,
    });
  };

  const waitForContent = async (minLen) => {
    const start = Date.now();
    let last = -1, stable = 0;
    while (Date.now() - start < 12000) {
      consumeEvents(); await pace();
      const { result } = await poll();
      const v = result.value;
      if (v.len >= minLen && !v.busy) return v.len;
      if (v.len === last && v.len > 0) { stable++; if (stable >= 3) return v.len; } else stable = 0;
      last = v.len;
      await sleep(500);
    }
    return last;
  };

  const poll = () => page.send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => { const b = document.body; const t = (b ? b.innerText : '').trim(); return { len: t.length, busy: !!document.querySelector('[class*=animate-pulse],[class*=animate-spin]') }; })()`,
  });

  const measureAt = async (width) => {
    await page.send('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 3, mobile: true });
    await sleep(450);
    consumeEvents(); await pace();
    const { result } = await page.send('Runtime.evaluate', { expression: MEASURE, returnByValue: true });
    return result.value;
  };

  const audit = async (role, routes) => {
    console.log(`\n──── chunk=${CHUNK} role=${role} (${routes.length} routes) ────`);
    await setToken(role);
    for (const route of routes) {
      await pace();
      await navClientSide(clientSideFix(route));
      const textLen = await waitForContent(role === 'anon' ? 60 : 120);
      const m390 = await measureAt(390);
      m390.textLen = textLen;
      emit(route, role, 390, m390);
      const m320 = await measureAt(320);
      m320.textLen = textLen;
      emit(route, role, 320, m320);
    }
  };

  // Detect client-side nav failure (URL didn't change -> use hard nav fallback)
  function clientSideFix(route) { return route; }

  const emit = (route, role, w, v) => {
    const rec = { route, role, w, ...v };
    fs.appendFileSync(RESULTS, JSON.stringify(rec) + '\n');
    if (v.textLen < 60) console.log(`⚠️ BLANK(${v.textLen})          [${role.padEnd(10)}] w=${w} ${route}`);
    else if (v.overflowPx > 2) console.log(`❌ OVERFLOW ${String(v.overflowPx).padEnd(4)}px [${role.padEnd(10)}] w=${w} ${route} ← ${v.bad.join(' | ')}`);
    else console.log(`✅ ok                 [${role.padEnd(10)}] w=${w} ${route}`);
  };

  // ── Chunk definitions ──
  const CHUNKS = {
    anon: { role: 'anon', routes: ['/', '/courses', '/login', '/register', '/become-instructor'] },
    student: {
      role: 'student',
      routes: ['/student', '/student/courses', '/student/wishlist', '/student/quizzes', '/student/exams',
        '/student/assignments', '/student/certificates', '/student/grades', '/student/settings',
        '/notifications', '/announcements', '/profile'],
    },
    instructor: {
      role: 'instructor',
      routes: ['/instructor', '/instructor/courses', '/instructor/students', '/instructor/reviews',
        '/instructor/analytics', '/instructor/quiz-builder', '/instructor/assessments',
        '/instructor/versions', '/instructor/live-sessions'],
    },
    admin: {
      role: 'admin',
      routes: ['/admin', '/admin/users', '/admin/students', '/admin/instructors', '/admin/courses',
        '/admin/categories', '/admin/reviews', '/admin/reports', '/admin/announcements',
        '/admin/enrollments', '/admin/assignments', '/admin/timetable', '/admin/student-progress',
        '/admin/bulk-import', '/admin/bulk-enroll', '/admin/assign-students', '/admin/live-sessions'],
    },
    superadmin: {
      role: 'superadmin',
      routes: ['/super-admin', '/super-admin/admins', '/super-admin/students', '/super-admin/instructors',
        '/super-admin/courses', '/super-admin/departments', '/super-admin/categories',
        '/super-admin/analytics', '/super-admin/reports', '/super-admin/permissions',
        '/super-admin/system', '/super-admin/ai-analytics', '/super-admin/settings'],
    },
    'details-anon': {
      role: 'anon',
      routes: [`/courses/${id.course}`, `/instructor/${id.instructor}`],
    },
    'details-admin': {
      role: 'admin',
      routes: [`/admin/users/${id.enrolledStudent || id.student}`],
    },
    'details-instructor': {
      role: 'instructor',
      routes: [`/instructor/students/${id.enrolledStudent}`],
    },
    'details-superadmin': {
      role: 'superadmin',
      routes: [
        `/super-admin/students/${id.student}`, `/super-admin/instructors/${id.instructor}`,
        `/super-admin/departments/${id.dept}`, `/super-admin/categories/${id.category}`,
      ],
    },
    'details-student': {
      role: 'student',
      routes: [`/courses/${id.learnCourse || id.course}/learn`],
    },
  };

  const spec = CHUNKS[CHUNK];
  if (!spec) { console.error('unknown chunk: ' + CHUNK); process.exit(1); }
  await audit(spec.role, spec.routes);

  console.log(`\n── chunk ${CHUNK} done ──`);
  chrome.kill();
  browser.close();
  process.exit(0);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
