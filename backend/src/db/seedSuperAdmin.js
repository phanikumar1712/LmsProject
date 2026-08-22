// Standalone SUPER_ADMIN seed, extracted from migrate.js so it can be unit-tested
// without running the entire migration (which self-executes on require).
//
// The upsert is idempotent: a fresh database inserts the account, while an
// existing database created by an older seed that used the placeholder name
// 'Test' gets its name corrected to 'Super Admin' on the next migrate run.
//
// Password policy:
//   - Dev/test (NODE_ENV != production): falls back to the legacy 'superadmin'
//     default, and the password is NEVER touched on conflict so a manually
//     changed dev password survives re-runs.
//   - Production: SUPER_ADMIN_PASSWORD is REQUIRED (missing -> hard error, so a
//     live deployment can never silently end up with zero super admins or a
//     known default password). When set, it is applied on conflict too, so a
//     pre-existing account seeded with the legacy default is healed.
const bcrypt = require('bcryptjs');

const SUPER_ADMIN_NAME = 'Super Admin';
const SUPER_ADMIN_EMAIL = 'superadmin@lms.com';

/**
 * Upsert the SUPER_ADMIN account.
 *
 * @param {{ query(sql: string, params?: any[]): Promise<{rows: any[]}> }} client - A DB client (pool client or fake).
 * @param {{ rounds?: number }} [options] - bcrypt cost factor (default 12).
 * @returns {Promise<string>} The super-admin email (for convenience/assertions).
 * @throws {Error} In production when SUPER_ADMIN_PASSWORD is not set.
 */
const seedSuperAdmin = async (client, { rounds = 12 } = {}) => {
    const isProduction = process.env.NODE_ENV === 'production';
    const explicitPassword = process.env.SUPER_ADMIN_PASSWORD;
    const password = explicitPassword || (isProduction ? null : 'superadmin');
    if (!password) {
        // Fail hard in production: a live deployment must never run without a
        // super admin, and must never fall back to a known default password.
        throw new Error(
            '[seed] SUPER_ADMIN_PASSWORD is not set — required in production. '
            + 'Set it in backend/.env and re-run `npm run migrate`.'
        );
    }
    const superAdminPass = await bcrypt.hash(password, rounds);
    // In production the operator's explicit SUPER_ADMIN_PASSWORD is the source
    // of truth: rotate the password even if a pre-existing account (e.g. one
    // seeded with the legacy 'superadmin' default before this fix) already
    // exists. In dev/test the password is never touched on conflict so a
    // manually-changed dev password survives re-runs.
    const setPasswordOnConflict = isProduction && explicitPassword
        ? ', password = EXCLUDED.password'
        : '';
    await client.query(
        `INSERT INTO users(name, email, password, role, avatar)
         VALUES($1, $2, $3, 'SUPER_ADMIN', '')
         ON CONFLICT(email) DO UPDATE SET name = EXCLUDED.name${setPasswordOnConflict};`,
        [SUPER_ADMIN_NAME, SUPER_ADMIN_EMAIL, superAdminPass]
    );
    return SUPER_ADMIN_EMAIL;
};

module.exports = { seedSuperAdmin, SUPER_ADMIN_NAME, SUPER_ADMIN_EMAIL };
