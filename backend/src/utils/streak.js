const { query } = require('../db/pool');

/**
 * Updates a student's learning streak based on today's activity.
 * @param {string} studentId - The ID of the student.
 * @returns {Promise<Object>} - The updated streak info.
 */
async function updateStreak(studentId) {
    try {
        const userRes = await query(
            'SELECT current_streak, longest_streak, last_activity_date FROM users WHERE id = $1',
            [studentId]
        );

        if (!userRes.rows.length) return null;

        const user = userRes.rows[0];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const lastActivity = user.last_activity_date ? new Date(user.last_activity_date) : null;
        if (lastActivity) lastActivity.setHours(0, 0, 0, 0);

        let newStreak = user.current_streak;
        let newLongest = user.longest_streak;

        if (!lastActivity) {
            // First activity ever
            newStreak = 1;
        } else {
            const diffDays = Math.floor((today - lastActivity) / (1000 * 60 * 60 * 24));

            if (diffDays === 1) {
                // Consecutive day
                newStreak += 1;
            } else if (diffDays > 1) {
                // Streak broken
                newStreak = 1;
            } else if (diffDays === 0) {
                // Already active today
                return { currentStreak: newStreak, longestStreak: newLongest };
            }
        }

        if (newStreak > newLongest) {
            newLongest = newStreak;
        }

        await query(
            'UPDATE users SET current_streak = $1, longest_streak = $2, last_activity_date = $3 WHERE id = $4',
            [newStreak, newLongest, today, studentId]
        );

        return { currentStreak: newStreak, longestStreak: newLongest };
    } catch (err) {
        console.error('Error updating streak:', err);
        return null;
    }
}

module.exports = { updateStreak };
