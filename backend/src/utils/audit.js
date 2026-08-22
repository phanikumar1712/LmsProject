// ── AUDIT TRAIL HELPER ───────────────────────────────────────────────────────
// Every sensitive action should write one audit row capturing:
//   WHO     → actor (req.user) + role
//   WHAT    → action (e.g. 'USER_STATUS_CHANGED')
//   WHEN    → created_at (DB default)
//   WHICH   → resource + resource_id
//   OLD/NEW → old_value / new_value JSONB (before/after of the mutated field)
//   CONTEXT → ip_address + device (parsed from the User-Agent header)
//
// Usage:
//   await writeAudit(req, {
//       action: 'USER_STATUS_CHANGED',
//       resource: 'users',
//       resourceId: userId,
//       oldValue: { active: true },
//       newValue: { active: false },
//       details: { studentId: 'CSE102' },
//   });
//
// writeAudit never throws — a failed audit write must not break the action it
// is recording.

// Best-effort User-Agent → { browser, os, device } parsing. Falls back to
// 'Unknown' for anything that can't be classified. Kept dependency-free so the
// whole stack stays lightweight.
const parseDevice = (ua = '') => {
    if (!ua) return { browser: 'Unknown', os: 'Unknown', device: 'Unknown' };
    const s = String(ua);
    let browser = 'Unknown';
    if (/Edg\//.test(s)) browser = 'Edge';
    else if (/OPR\/|Opera/.test(s)) browser = 'Opera';
    else if (/Chrome\//.test(s) && !/Chromium/.test(s)) browser = 'Chrome';
    else if (/Firefox\//.test(s)) browser = 'Firefox';
    else if (/Safari\//.test(s) && !/Chrome/.test(s)) browser = 'Safari';
    else if (/MSIE|Trident/.test(s)) browser = 'Internet Explorer';
    else if (/PostmanRuntime/.test(s)) browser = 'Postman';
    else if (/axios/.test(s)) browser = 'API client';
    else if (/curl\//.test(s)) browser = 'curl';

    let os = 'Unknown';
    if (/Windows/.test(s)) os = 'Windows';
    else if (/iPhone|iPad|iPod/.test(s)) os = 'iOS';
    else if (/Mac OS X|Macintosh/.test(s)) os = 'macOS';
    else if (/Android/.test(s)) os = 'Android';
    else if (/Linux/.test(s)) os = 'Linux';

    let device = 'Desktop';
    if (/iPhone|iPad|iPod|Android.*Mobile|Mobile/.test(s)) device = 'Mobile';
    else if (/Tablet|iPad/.test(s)) device = 'Tablet';

    return { browser, os, device };
};

// Extract the client IP. When running behind a reverse proxy (Heroku/Render/
// nginx) the real client IP is in x-forwarded-for; req.ip is used as fallback.
const clientIp = (req) => {
    if (!req) return null;
    const fwd = req.headers?.['x-forwarded-for'];
    if (fwd) {
        const first = String(fwd).split(',')[0].trim();
        if (first) return first;
    }
    return req.ip || req.socket?.remoteAddress || null;
};

const writeAudit = async (req, { action, resource, resourceId = null, oldValue, newValue, details = {} } = {}) => {
    try {
        if (!action || !resource) return;
        const device = parseDevice(req?.headers?.['user-agent']);
        const payload = {
            ...(details || {}),
            device,
        };
        // Lazy require so the pool can be swapped in tests (require.cache
        // injection) — the destructured `query` binding stays live.
        const { query } = require('../db/pool');
        await query(
            `INSERT INTO audit_logs
                (user_id, action, resource, resource_id, details, old_value, new_value, ip_address)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [
                req?.user?.id || null,
                action,
                resource,
                resourceId || null,
                JSON.stringify(payload),
                oldValue === undefined ? null : JSON.stringify(oldValue),
                newValue === undefined ? null : JSON.stringify(newValue),
                clientIp(req),
            ]
        );
    } catch (err) {
        console.error(`[Audit] Failed to log ${action}:`, err.message);
    }
};

module.exports = { writeAudit, parseDevice, clientIp };
