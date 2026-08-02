// Standalone SUPER_ADMIN seed, extracted from migrate.js so it can be unit-tested
// without running the entire migration (which self-executes on require).
//
// The upsert is idempotent: a fresh database inserts the account, while an
// existing database created by an older seed that used the placeholder name
// 'Test' gets its name corrected to 'Super Admin' on the next migrate run.
// The password is intentionally NEVER touched by the ON CONFLICT branch — an
// existing account keeps whatever credentials it already has.
const bcrypt = require('bcryptjs');

const SUPER_ADMIN_NAME = 'Super Admin';
const SUPER_ADMIN_EMAIL = 'superadmin@lms.com';

/**
 * Upsert the SUPER_ADMIN demo account.
 *
 * @param {{ query(sql: string, params?: any[]): Promise<{rows: any[]}> }} client - A DB client (pool client or fake).
 * @returns {Promise<string>} The super-admin email (for convenience/assertions).
 */
const seedSuperAdmin = async (client, { rounds = 12 } = {}) => {
    const superAdminPass = await bcrypt.hash('superadmin', rounds);
    await client.query(
        `INSERT INTO users(name, email, password, role, avatar)
         VALUES($1, $2, $3, 'SUPER_ADMIN', '')
         ON CONFLICT(email) DO UPDATE SET name = EXCLUDED.name;`,
        [SUPER_ADMIN_NAME, SUPER_ADMIN_EMAIL, superAdminPass]
    );
    return SUPER_ADMIN_EMAIL;
};

module.exports = { seedSuperAdmin, SUPER_ADMIN_NAME, SUPER_ADMIN_EMAIL };
