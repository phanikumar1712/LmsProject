const { Client } = require('pg');
require('dotenv').config();

async function fix() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        await client.query(`
            ALTER TABLE users ADD COLUMN IF NOT EXISTS current_streak INTEGER DEFAULT 0;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS longest_streak INTEGER DEFAULT 0;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS last_activity_date DATE;
        `);
        console.log("✅ Streak columns added to users table");

        // Populate initial streaks from audit_logs for existing users
        console.log("⏳ Calculating initial streaks for existing users...");
        const users = await client.query("SELECT id FROM users WHERE role = 'STUDENT'");

        for (const user of users.rows) {
            const result = await client.query(`
                SELECT DISTINCT DATE(created_at) as date
                FROM audit_logs
                WHERE user_id = $1
                  AND action IN ('LESSON_COMPLETED', 'QUIZ_ATTEMPTED')
                ORDER BY date DESC
            `, [user.id]);

            if (result.rows.length === 0) continue;

            const dates = result.rows.map(r => new Date(r.date));
            let currentStreak = 0;
            let lastDate = null;
            let longestStreak = 0;
            let tempStreak = 0;

            // Current streak calculation
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            let streakBroken = false;
            let checkDate = new Date(today);

            // If the last activity was yesterday or today, the streak is alive
            const mostRecentActivity = dates[0];
            const diffDays = Math.floor((today - mostRecentActivity) / (1000 * 60 * 60 * 24));

            if (diffDays <= 1) {
                // Calculate current streak
                for (let i = 0; i < dates.length; i++) {
                    if (i === 0) {
                        currentStreak = 1;
                    } else {
                        const d1 = dates[i - 1];
                        const d2 = dates[i];
                        const diff = Math.floor((d1 - d2) / (1000 * 60 * 60 * 24));
                        if (diff === 1) {
                            currentStreak++;
                        } else {
                            break;
                        }
                    }
                }
            } else {
                currentStreak = 0;
            }

            // Longest streak calculation
            let maxStreak = 0;
            let currentCount = 0;
            for (let i = 0; i < dates.length; i++) {
                if (i === 0) {
                    currentCount = 1;
                } else {
                    const d1 = dates[i - 1];
                    const d2 = dates[i];
                    const diff = Math.floor((d1 - d2) / (1000 * 60 * 60 * 24));
                    if (diff === 1) {
                        currentCount++;
                    } else {
                        maxStreak = Math.max(maxStreak, currentCount);
                        currentCount = 1;
                    }
                }
            }
            maxStreak = Math.max(maxStreak, currentCount);

            await client.query(`
                UPDATE users 
                SET current_streak = $1, longest_streak = $2, last_activity_date = $3 
                WHERE id = $4
            `, [currentStreak, maxStreak, mostRecentActivity, user.id]);
        }
        console.log("✅ Initial streaks populated");

    } catch (e) {
        console.error("❌ Error adding streak columns:", e.message);
    } finally {
        await client.end().catch(() => { });
    }
}

fix();
