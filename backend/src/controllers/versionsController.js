const { query } = require('../db/pool');
const { createError } = require('../middleware/errorHandler');
const { assertCourseEditable, assertChildEditable } = require('../utils/courseAuth');

// Helper: Build a full course snapshot (sections + lessons + quizzes)
const buildCourseSnapshot = async (courseId) => {
    const sections = await query(
        `SELECT id, title, "order" FROM sections WHERE course_id = $1 ORDER BY "order" ASC`,
        [courseId]
    );

    const lessons = await query(
        `SELECT id, section_id, title, type, content_url, duration, preview, "order",
                release_date, drip_delay_days
         FROM lessons WHERE course_id = $1 ORDER BY "order" ASC`,
        [courseId]
    );

    const quizzes = await query(
        `SELECT q.id, q.lesson_id, q.title, q.description, q.passing_score,
                q.time_limit, q.questions, q.selection_config
         FROM quizzes q WHERE q.course_id = $1`,
        [courseId]
    );

    return {
        sections: sections.rows,
        lessons: lessons.rows,
        quizzes: quizzes.rows,
        captured_at: new Date().toISOString(),
    };
};

// POST /api/courses/:id/versions — Create a new version snapshot (instructor publishes)
const createVersion = async (req, res) => {
    const { id } = req.params;
    const { changelog = '', versionLabel = '' } = req.body;

    // Verify ownership (instructor) or department scope (admin). Snapshots
    // contain quiz answers, so only course editors may create them.
    // (assertCourseEditable already 404s when the course is missing — the
    // second lookup below only needs the status.)
    await assertCourseEditable(req, id);
    const course = await query('SELECT status FROM courses WHERE id = $1', [id]);
    if (!course.rows.length) throw createError('Course not found', 404);
    if (course.rows[0].status !== 'PUBLISHED') {
        throw createError('Only published courses can have versions', 400);
    }

    // Get next version number
    const lastVersion = await query(
        'SELECT MAX(version_number) as max_v FROM course_versions WHERE course_id = $1',
        [id]
    );
    const nextVersion = (lastVersion.rows[0]?.max_v || 0) + 1;

    const snapshot = await buildCourseSnapshot(id);

    const result = await query(
        `INSERT INTO course_versions (course_id, version_number, version_label, changelog, snapshot)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [id, nextVersion, versionLabel || `v${nextVersion}`, changelog, JSON.stringify(snapshot)]
    );

    // Assign this version to enrollments created since the last version was published.
    // This prevents a student who enrolled mid-way from being bumped to a newer version.
    // If there was a previous version, only update enrollments created after it.
    const prevResult = await query(
        'SELECT created_at FROM course_versions WHERE course_id = $1 AND version_number = $2',
        [id, nextVersion - 1]
    );
    const prevCreatedAt = prevResult.rows.length ? prevResult.rows[0].created_at : new Date(0).toISOString();

    await query(
        `UPDATE enrollments SET version_id = $1
         WHERE course_id = $2
           AND version_id IS NULL
           AND enrolled_at >= $3`,
        [result.rows[0].id, id, prevCreatedAt]
    );

    await query(
        `INSERT INTO audit_logs (user_id, action, resource, resource_id, details)
         VALUES ($1, $2, $3, $4, $5)`,
        [req.user.id, 'COURSE_VERSION_CREATED', 'courses', id,
         JSON.stringify({ version: nextVersion, changelog })]
    ).catch(() => {});

    res.status(201).json(result.rows[0]);
};

// Gate: who may read a course's version list. Editors always pass; students
// must be enrolled in the course.
const assertVersionsReadable = async (req, courseId) => {
    if (req.user.role === 'STUDENT') {
        const enrolled = await query(
            'SELECT 1 FROM enrollments WHERE student_id = $1 AND course_id = $2',
            [req.user.id, courseId]
        );
        if (!enrolled.rows.length) throw createError('Not enrolled in this course', 403);
        return;
    }
    // Instructors may only list versions of their own courses; scoped admins
    // only of in-department courses. (Also 404s when the course is missing.)
    await assertCourseEditable(req, courseId);
};

// GET /api/courses/:id/versions — List all versions
const getVersions = async (req, res) => {
    const { id } = req.params;
    // The list only exposes metadata (labels + changelogs), so enrolled
    // students may view it; editors get the same list. Non-enrolled users
    // (and students outside the course) are blocked.
    await assertVersionsReadable(req, id);

    const result = await query(
        `SELECT id, version_number, version_label, changelog, created_at
         FROM course_versions WHERE course_id = $1
         ORDER BY version_number DESC`,
        [id]
    );
    res.json(result.rows);
};

// GET /api/courses/:id/versions/:versionId — Get a specific version's snapshot
const getVersionById = async (req, res) => {
    const { id, versionId } = req.params;
    // Snapshots embed full quiz question banks INCLUDING correct answers —
    // only course editors (instructor / in-scope admin / SUPER_ADMIN) may read
    // them. Students never receive answer keys.
    await assertCourseEditable(req, id);

    const result = await query(
        `SELECT * FROM course_versions WHERE id = $1 AND course_id = $2`,
        [versionId, id]
    );
    if (!result.rows.length) throw createError('Version not found', 404);
    res.json(result.rows[0]);
};

// PUT /api/courses/:id/versions/:versionId/changelog — Update changelog
const updateChangelog = async (req, res) => {
    const { id, versionId } = req.params;
    const { changelog, versionLabel } = req.body;

    await assertCourseEditable(req, id);

    const updates = [];
    const values = [];
    let i = 1;
    if (changelog !== undefined) { updates.push(`changelog = $${i++}`); values.push(changelog); }
    if (versionLabel !== undefined) { updates.push(`version_label = $${i++}`); values.push(versionLabel); }
    if (!updates.length) throw createError('No fields to update', 400);
    values.push(versionId, id);

    const result = await query(
        `UPDATE course_versions SET ${updates.join(', ')} WHERE id = $${i++} AND course_id = $${i} RETURNING id`,
        values
    );
    if (!result.rows.length) throw createError('Version not found', 404);
    res.json({ success: true });
};

// GET /api/courses/:id/drip-status — Check drip access for the current student
const getDripStatus = async (req, res) => {
    const { id: courseId } = req.params;

    const course = await query(
        'SELECT id, drip_mode FROM courses WHERE id = $1',
        [courseId]
    );
    if (!course.rows.length) throw createError('Course not found', 404);

    // Must be enrolled to check drip status (prevents leaking lesson timings to non-students)
    const enrollment = await query(
        `SELECT id, enrolled_at, version_id FROM enrollments
         WHERE student_id = $1 AND course_id = $2`,
        [req.user.id, courseId]
    );
    if (!enrollment.rows.length && req.user.role === 'STUDENT') {
        throw createError('You must be enrolled to view drip schedule', 403);
    }

    const lessons = await query(
        `SELECT id, title, release_date, drip_delay_days
         FROM lessons WHERE course_id = $1 ORDER BY "order" ASC`,
        [courseId]
    );

    const dripMode = course.rows[0].drip_mode || 'none';
    const enrolledAt = enrollment.rows[0]?.enrolled_at
        ? new Date(enrollment.rows[0].enrolled_at)
        : null;
    const now = new Date();

    const dripStatus = lessons.rows.map(lesson => {
        let unlocked = true;
        let reason = null;

        if (dripMode === 'absolute' || dripMode === 'both') {
            if (lesson.release_date) {
                const releaseDate = new Date(lesson.release_date);
                if (now < releaseDate) {
                    unlocked = false;
                    reason = `Available on ${releaseDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
                }
            }
        }

        if (dripMode === 'relative' || dripMode === 'both') {
            if (lesson.drip_delay_days && enrolledAt) {
                const unlockDate = new Date(enrolledAt);
                unlockDate.setDate(unlockDate.getDate() + lesson.drip_delay_days);
                if (now < unlockDate) {
                    unlocked = false;
                    const daysLeft = Math.ceil((unlockDate - now) / (1000 * 60 * 60 * 24));
                    reason = `Available in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`;
                }
            }
        }

        return {
            lessonId: lesson.id,
            title: lesson.title,
            unlocked,
            reason,
            releaseDate: lesson.release_date,
            dripDelayDays: lesson.drip_delay_days,
        };
    });

    res.json({ dripMode, dripStatus });
};

module.exports = {
    createVersion, getVersions, getVersionById, updateChangelog, getDripStatus,
};
