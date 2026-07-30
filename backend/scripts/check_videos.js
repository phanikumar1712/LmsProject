require('dotenv').config();
const { query } = require('../src/db/pool');
(async () => {
    const lessons = await query(
        "SELECT l.id, l.title, l.type, l.content_url, l.preview, c.title as course_title, c.id as course_id FROM lessons l JOIN courses c ON c.id = l.course_id WHERE l.type = 'video' ORDER BY l.created_at DESC LIMIT 10"
    );
    console.log('Total video lessons:', lessons.rows.length);
    for (const l of lessons.rows) {
        const url = l.content_url || '';
        const isYT = url.includes('youtube') || url.includes('youtu.be');
        const hasUrl = !!l.content_url && l.content_url.trim() !== '';
        console.log(JSON.stringify({
            course: l.course_title,
            courseId: l.course_id,
            lesson: l.title,
            lessonId: l.id,
            type: l.type,
            preview: l.preview,
            hasUrl,
            isYouTube: isYT,
            urlPreview: hasUrl ? url.substring(0, 80) : 'NONE'
        }));
    }

    // Check enrollments for a student in one of these courses
    if (lessons.rows.length > 0) {
        const courseId = lessons.rows[0].course_id;
        const enrolls = await query(
            'SELECT e.student_id, u.name, u.email FROM enrollments e JOIN users u ON u.id = e.student_id WHERE e.course_id = $1 LIMIT 3',
            [courseId]
        );
        console.log('\nEnrollments for', lessons.rows[0].course_title + ':', enrolls.rows.length);
        for (const e of enrolls.rows) {
            console.log('  -', e.name, '|', e.email, '|', e.student_id);
        }
    }

    await query.pool.end();
})();
