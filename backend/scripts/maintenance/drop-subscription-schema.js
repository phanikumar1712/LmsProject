// One-off cleanup: removes the leftover subscription/pricing schema from an
// existing database that was created before the subscription feature was removed.
//
// This drops:
//   - tables:   subscription_plans, subscription_plan_courses
//   - columns:  courses.price, courses.discount_price, courses.required_plan
//               users.subscription_plan, users.subscription_expiry, users.earnings
//   - type:     subscription_plan (enum, only if no longer referenced)
//
// Safe by design:
//   - Dry-run by default: prints what WOULD be dropped without touching the DB.
//   - Run with `--apply` to actually execute the drops.
//   - Every statement is guarded with IF EXISTS / existence checks, so it is
//     idempotent and safe to re-run.
//
// Uses the project's db pool (which applies the IPv4 monkey-patch required to
// reach NeonDB reliably), so run it from the backend directory like the app.
//
// Usage:
//   node scripts/maintenance/drop-subscription-schema.js            # dry-run preview
//   node scripts/maintenance/drop-subscription-schema.js --apply    # execute

require('dotenv').config();
const { query, pool } = require('../../src/db/pool');

const APPLY = process.argv.includes('--apply');

// Order matters: drop the child table first so the FK to subscription_plans is gone.
const TABLES = ['subscription_plan_courses', 'subscription_plans'];

const COLUMNS = [
    { table: 'courses', column: 'price' },
    { table: 'courses', column: 'discount_price' },
    { table: 'courses', column: 'required_plan' },
    { table: 'users', column: 'subscription_plan' },
    { table: 'users', column: 'subscription_expiry' },
    { table: 'users', column: 'earnings' },
];

async function main() {
    try {
        console.log(`Connected. Mode: ${APPLY ? 'APPLY (destructive)' : 'DRY-RUN (no changes)'}\n`);

        // ── Tables ────────────────────────────────────────────────────────────
        for (const table of TABLES) {
            const exists = await query(
                `SELECT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema = 'public' AND table_name = $1) AS ok`,
                [table]
            );
            if (!exists.rows[0].ok) {
                console.log(`• table "${table}": not present, skipping`);
                continue;
            }
            if (APPLY) {
                await query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
                console.log(`✅ dropped table "${table}"`);
            } else {
                console.log(`→ would drop table "${table}"`);
            }
        }

        // ── Columns ───────────────────────────────────────────────────────────
        for (const { table, column } of COLUMNS) {
            const exists = await query(
                `SELECT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2) AS ok`,
                [table, column]
            );
            if (!exists.rows[0].ok) {
                console.log(`• column "${table}.${column}": not present, skipping`);
                continue;
            }
            if (APPLY) {
                await query(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS "${column}"`);
                console.log(`✅ dropped column "${table}.${column}"`);
            } else {
                console.log(`→ would drop column "${table}.${column}"`);
            }
        }

        // ── Enum type ─────────────────────────────────────────────────────────
        // Only drop `subscription_plan` if no column still references it
        // (e.g. courses.required_plan was also of this type).
        const typeExists = await query(
            `SELECT EXISTS (
                SELECT 1 FROM pg_type t
                JOIN pg_namespace n ON n.oid = t.typnamespace
                WHERE t.typname = 'subscription_plan' AND n.nspname = 'public'
             ) AS ok`
        );
        if (typeExists.rows[0].ok) {
            const refs = await query(
                `SELECT count(*)::int AS n
                 FROM pg_attribute a
                 JOIN pg_class c ON c.oid = a.attrelid
                 JOIN pg_namespace n ON n.oid = c.relnamespace
                 JOIN pg_type t ON t.oid = a.atttypid
                 WHERE n.nspname = 'public'
                   AND t.typname = 'subscription_plan'
                   AND a.attnum > 0`
            );
            if (refs.rows[0].n > 0) {
                console.log(`• enum type "subscription_plan": still referenced by ${refs.rows[0].n} column(s), skipping`);
            } else {
                if (APPLY) {
                    await query('DROP TYPE IF EXISTS subscription_plan');
                    console.log('✅ dropped enum type "subscription_plan"');
                } else {
                    console.log('→ would drop enum type "subscription_plan"');
                }
            }
        } else {
            console.log('• enum type "subscription_plan": not present, skipping');
        }

        console.log(`\n${APPLY ? 'Cleanup complete.' : 'Dry-run complete. Re-run with --apply to execute these changes.'}`);
    } catch (e) {
        console.error('❌ Error:', e.message);
        process.exitCode = 1;
    } finally {
        await pool.end().catch(() => { });
    }
}

main();
