const { query } = require('./src/db/pool');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function fixInstructor() {
    console.log('--- Checking Instructor Account ---');
    try {
        const email = 'instructor@demo.com';
        const result = await query('SELECT id, name, role, active FROM users WHERE email = $1', [email]);

        if (result.rows.length === 0) {
            console.log('Instructor not found, creating...');
            const hashed = await bcrypt.hash('password123', 12);
            await query(
                'INSERT INTO users (name, email, password, role, active) VALUES ($1, $2, $3, $4, $5)',
                ['Demo Instructor', email, hashed, 'INSTRUCTOR', true]
            );
            console.log('Created instructor@demo.com / password123');
        } else {
            const user = result.rows[0];
            console.log('Found user:', user);
            if (user.role !== 'INSTRUCTOR') {
                console.log('Fixing role to INSTRUCTOR...');
                await query('UPDATE users SET role = $1 WHERE id = $2', ['INSTRUCTOR', user.id]);
            }
            if (!user.active) {
                console.log('Activating user...');
                await query('UPDATE users SET active = $1 WHERE id = $2', [true, user.id]);
            }
            // Reset password to be sure
            const hashed = await bcrypt.hash('password123', 12);
            await query('UPDATE users SET password = $1 WHERE id = $2', [hashed, user.id]);
            console.log('Reset password to password123');
        }
        console.log('--- Auth Fix Complete ---');
    } catch (err) {
        console.error('Error fixing instructor:', err);
    } finally {
        process.exit();
    }
}

fixInstructor();
