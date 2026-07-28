const { query } = require('../db/pool');
const { createError } = require('../middleware/errorHandler');
const { mapCourse, normalizePlan } = require('../utils/formatters');
const { getDepartmentScope } = require('../utils/scope');

const courseFields = `
    c.id, c.title, c.description, c.short_desc, c.thumbnail, c.price, c.discount_price,
    c.level, c.language, c.tags, c.what_you_learn, c.requirements,
    c.status, c.rating, c.review_count, c.enrollment_count, c.duration,
    c.certificate, c.required_plan, c.created_at, c.updated_at,
    COALESCE(sp_agg.accessible_plans, '{}'::text[]) as "accessiblePlans",
    COALESCE(l_agg.lesson_count, 0)::int as "lessonsCount",
    u.id as "instructorId", u.name as "instructorName", u.avatar as "instructorAvatar", u.bio as "instructorBio",
    u.role as "instructorRole", u.subscription_plan as "instructorPlan",
    u.created_at as "instructorJoined",
    cat.id as "categoryId", cat.name as "categoryName", cat.icon as "categoryIcon"
`;

// Co-authored lateral join fragments used in most course queries to replace
// N+1 correlated subqueries with set-oriented joins.
const courseJoins = `
    LEFT JOIN LATERAL (
        SELECT array_agg(sp.name ORDER BY spc.priority ASC) AS accessible_plans
        FROM subscription_plan_courses spc
        JOIN subscription_plans sp ON sp.id = spc.plan_id
        WHERE spc.course_id = c.id
    ) sp_agg ON true
    LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS lesson_count
        FROM lessons l
        WHERE l.course_id = c.id
    ) l_agg ON true
`;

const isAdminUser = (user) => user && ['ADMIN', 'SUPER_ADMIN'].includes(user.role);

// Verify that the authenticated user owns the course that contains this section.
// Throws 404 if section doesn't exist, 403 if not authorized.
const assertSectionOwnership = async (req, sectionId) => {
    const result = await query(
        `SELECT c.instructor_id FROM sections s
         JOIN courses c ON s.course_id = c.id
         WHERE s.id = $1`,
        [sectionId]
    );
    if (!result.rows.length) throw createError('Section not found', 404);
    if (req.user.role === 'INSTRUCTOR' && result.rows[0].instructor_id !== req.user.id) {
        throw createError('Not authorized to modify this section', 403);
    }
};

// Verify that the authenticated user owns the course that contains this lesson.
// Throws 404 if lesson doesn't exist, 403 if not authorized.
const assertLessonOwnership = async (req, lessonId) => {
    const result = await query(
        `SELECT c.instructor_id FROM lessons l
         JOIN courses c ON l.course_id = c.id
         WHERE l.id = $1`,
        [lessonId]
    );
    if (!result.rows.length) throw createError('Lesson not found', 404);
    if (req.user.role === 'INSTRUCTOR' && result.rows[0].instructor_id !== req.user.id) {
        throw createError('Not authorized to modify this lesson', 403);
    }
};

// Verify that the authenticated user owns this course (instructors only;
// admins pass through). Throws 404 if course doesn't exist, 403 if not authorized.
const assertCourseOwnership = async (req, courseId) => {
    const result = await query('SELECT instructor_id FROM courses WHERE id = $1', [courseId]);
    if (!result.rows.length) throw createError('Course not found', 404);
    if (req.user.role === 'INSTRUCTOR' && result.rows[0].instructor_id !== req.user.id) {
        throw createError('Not authorized to modify this course', 403);
    }
};

// For a department-scoped ADMIN, ensure the course belongs to their department
// (via course → category → department). Throws 403 on cross-department access.
const assertCourseInScope = async (req, courseId) => {
    const { scoped, departmentId } = getDepartmentScope(req);
    if (!scoped) return;
    const r = await query(
        `SELECT cat.department_id FROM courses c
         LEFT JOIN categories cat ON c.category_id = cat.id
         WHERE c.id = $1`,
        [courseId]
    );
    if (!r.rows.length) throw createError('Course not found', 404);
    if (r.rows[0].department_id !== departmentId) {
        throw createError('This course is outside your department', 403);
    }
};

const COURSE_UPDATE_ALIASES = {
    shortDesc: 'short_desc',
    discountPrice: 'discount_price',
    categoryId: 'category_id',
    requiredPlan: 'required_plan',
    startDate: 'start_date',
    endDate: 'end_date',
    reviewLevel: 'review_level',
};

const normalizeCourseUpdateBody = (body) => {
    const normalized = { ...body };
    Object.entries(COURSE_UPDATE_ALIASES).forEach(([from, to]) => {
        if (normalized[to] === undefined && normalized[from] !== undefined) {
            normalized[to] = normalized[from];
        }
    });
    ['price', 'discount_price'].forEach((field) => {
        if (normalized[field] === undefined) return;
        if (normalized[field] === '' || normalized[field] === null) {
            normalized[field] = field === 'price' ? 0 : null;
            return;
        }
        const value = Number(normalized[field]);
        if (!Number.isFinite(value) || value < 0) throw createError(`${field} must be a non-negative number`, 400);
        normalized[field] = value;
    });
    return normalized;
};

// GET /api/courses
const getAll = async (req, res) => {
    const { status, category, search, level, sort, limit = 50, offset = 0, admin, departmentId: qDepartmentId } = req.query;
    let conditions = [];
    let values = [];
    let i = 1;

    const adminView = admin === 'true' && isAdminUser(req.user);

    if (status && status.toUpperCase() !== 'ALL') {
        conditions.push(`c.status = $${i++}`);
        values.push(status.toUpperCase());
    } else if (!adminView) {
        conditions.push(`c.status = 'PUBLISHED'`);
    }

    // category filters by UUID id; ignore malformed values instead of letting
    // Postgres throw a 500 on cast (e.g. stale links with slug values).
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (category && UUID_RE.test(category)) { conditions.push(`cat.id = $${i++}`); values.push(category); }
    if (level) { conditions.push(`c.level = $${i++}`); values.push(level); }

    // Department isolation: a scoped ADMIN only manages courses whose category
    // belongs to their department. A SUPER_ADMIN may optionally pass departmentId
    // to filter by department.
    const { scoped, departmentId } = getDepartmentScope(req);
    if (adminView && scoped) {
        conditions.push(`cat.department_id = $${i++}`);
        values.push(departmentId);
    } else if (adminView && qDepartmentId) {
        // SUPER_ADMIN can filter courses by a specific department
        conditions.push(`cat.department_id = $${i++}`);
        values.push(qDepartmentId);
    }
    if (search) {
        // Escape LIKE wildcards to prevent performance issues and unintended matches
        const escapedSearch = search.replace(/[%_]/g, '\\$&');
        conditions.push(`(c.title ILIKE $${i} OR u.name ILIKE $${i})`);
        values.push(`%${escapedSearch}%`); i++;
    }

    let orderBy = 'c.created_at DESC';
    if (sort === 'popular') orderBy = 'c.enrollment_count DESC';
    if (sort === 'rating') orderBy = 'c.rating DESC';
    if (sort === 'price_low') orderBy = 'COALESCE(c.discount_price, c.price) ASC';
    if (sort === 'newest') orderBy = 'c.created_at DESC';

    const { getPagination } = require('../utils/pagination');

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countSql = `
        SELECT COUNT(*)::int as total
        FROM courses c
        JOIN users u ON c.instructor_id = u.id
        LEFT JOIN categories cat ON c.category_id = cat.id
        ${where}
    `;
    const countResult = await query(countSql, values);

    // Get paginated data
    const sql = `
        SELECT ${courseFields}
        FROM courses c
        JOIN users u ON c.instructor_id = u.id
        LEFT JOIN categories cat ON c.category_id = cat.id
        ${courseJoins}
        ${where}
        ORDER BY ${orderBy}
        LIMIT $${i++} OFFSET $${i++}
    `;

    const pageNum = Math.floor(parseInt(offset) / parseInt(limit)) + 1;
    const finalValues = [...values, parseInt(limit), parseInt(offset)];

    const result = await query(sql, finalValues);

    res.json({
        success: true,
        data: result.rows.map(mapCourse),
        pagination: getPagination(countResult.rows[0].total, pageNum, limit)
    });
};

// GET /api/courses/:id
const getById = async (req, res) => {
    const result = await query(
        `SELECT ${courseFields} FROM courses c
         JOIN users u ON c.instructor_id = u.id
         LEFT JOIN categories cat ON c.category_id = cat.id
         ${courseJoins}
         WHERE c.id = $1`,
        [req.params.id]
    );
    if (!result.rows.length) throw createError('Course not found', 404);
    res.json(mapCourse(result.rows[0]));
};

// GET /api/courses/:id/lessons
const getLessons = async (req, res) => {
    const { id: courseId } = req.params;

    // Single LEFT JOIN query instead of 2 separate round-trips.
    // Section-less sections still appear (they just have NULL lesson columns).
    const { rows } = await query(`
        SELECT
            s.id AS sec_id, s.title AS sec_title, s."order" AS sec_order, s.course_id, s.created_at AS sec_created,
            l.id, l.section_id, l.title, l.type, l.content_url, l.duration, l.preview, l."order", l.created_at
        FROM sections s
        LEFT JOIN lessons l ON l.section_id = s.id
        WHERE s.course_id = $1
        ORDER BY s."order" ASC, l."order" ASC NULLS LAST
    `, [courseId]);

    // De-duplicate sections (there will be one row per lesson per section)
    const seenSections = new Set();
    const sections = [];
    const lessons = [];
    for (const row of rows) {
        if (!seenSections.has(row.sec_id)) {
            seenSections.add(row.sec_id);
            sections.push({
                id: row.sec_id,
                course_id: row.course_id,
                title: row.sec_title,
                order: row.sec_order,
                created_at: row.sec_created,
                courseId: row.course_id,
                createdAt: row.sec_created,
            });
        }
        if (row.id) {
            lessons.push({
                id: row.id,
                section_id: row.section_id,
                course_id: row.course_id,
                title: row.title,
                type: row.type,
                content_url: row.content_url,
                duration: row.duration,
                preview: row.preview,
                order: row.order,
                created_at: row.created_at,
                sectionId: row.section_id,
                courseId: row.course_id,
                contentUrl: row.content_url,
                createdAt: row.created_at,
            });
        }
    }

    res.json({ sections, lessons });
};

// GET /api/courses/instructor/:instructorId
const getByInstructor = async (req, res) => {
    const result = await query(
        `SELECT ${courseFields} FROM courses c
         JOIN users u ON c.instructor_id = u.id
         LEFT JOIN categories cat ON c.category_id = cat.id
         ${courseJoins}
         WHERE c.instructor_id = $1
         ORDER BY c.created_at DESC`,
        [req.params.instructorId]
    );
    res.json(result.rows.map(mapCourse));
};

// Find-or-create a category by name (case-insensitive). Lets instructors use a
// custom category when creating a course without admin category management access.
const resolveCustomCategory = async (name) => {
    const trimmed = String(name || '').trim().slice(0, 100);
    if (!trimmed) return null;
    const existing = await query('SELECT id FROM categories WHERE LOWER(name) = LOWER($1) LIMIT 1', [trimmed]);
    if (existing.rows.length) return existing.rows[0].id;
    const created = await query(`INSERT INTO categories (name, icon) VALUES ($1, '📚') RETURNING id`, [trimmed]);
    return created.rows[0].id;
};

// POST /api/courses
const create = async (req, res) => {
    const {
        title, description, short_desc, shortDesc, thumbnail, price = 0, discount_price, discountPrice,
        level = 'Beginner', language = 'English', tags = [], what_you_learn = [], whatYouLearn,
        requirements = [], category_id, categoryId, duration = '0h', certificate = true,
        required_plan = 'FREE', requiredPlan, status: bodyStatus, custom_category, customCategory
    } = req.body;

    if (!title) throw createError('Title is required', 400);

    let finalCategoryId = category_id || categoryId || null;
    if (!finalCategoryId && (custom_category || customCategory)) {
        finalCategoryId = await resolveCustomCategory(custom_category || customCategory);
    }

    const allowedStatuses = ['DRAFT', 'PENDING'];
    const status = allowedStatuses.includes(String(bodyStatus || '').toUpperCase())
        ? String(bodyStatus).toUpperCase()
        : 'PENDING';

    const result = await query(
        `INSERT INTO courses (title, description, short_desc, instructor_id, category_id, thumbnail, price, discount_price, level, language, tags, what_you_learn, requirements, duration, certificate, required_plan, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
         RETURNING id`,
        [title, description, short_desc || shortDesc, req.user.id, finalCategoryId, thumbnail,
            price, discount_price || discountPrice || null, level, language, tags, what_you_learn || whatYouLearn || [], requirements,
            duration, certificate, normalizePlan(required_plan || requiredPlan), status]
    );

    await query(
        `INSERT INTO audit_logs (user_id, action, resource, resource_id) VALUES ($1,$2,$3,$4)`,
        [req.user.id, 'COURSE_CREATED', 'courses', result.rows[0].id]
    ).catch(() => { });

    const course = await query(
        `SELECT ${courseFields} FROM courses c JOIN users u ON c.instructor_id = u.id LEFT JOIN categories cat ON c.category_id = cat.id ${courseJoins} WHERE c.id = $1`,
        [result.rows[0].id]
    );
    res.status(201).json(mapCourse(course.rows[0]));
};

// PUT /api/courses/:id
const update = async (req, res) => {
    const { id } = req.params;
    const body = normalizeCourseUpdateBody(req.body);
    const existing = await query('SELECT instructor_id, status, title FROM courses WHERE id = $1', [id]);
    if (!existing.rows.length) throw createError('Course not found', 404);
    if (req.user.role === 'INSTRUCTOR' && existing.rows[0].instructor_id !== req.user.id) {
        throw createError('Not your course', 403);
    }
    // Only resolve/create a custom category after ownership is confirmed
    if (!body.category_id && (body.custom_category || body.customCategory)) {
        body.category_id = await resolveCustomCategory(body.custom_category || body.customCategory);
    }

    const fields = ['title', 'description', 'short_desc', 'thumbnail', 'price', 'discount_price',
        'level', 'language', 'tags', 'what_you_learn', 'requirements', 'category_id', 'duration', 'certificate', 'required_plan',
        'start_date', 'end_date', 'review_level', 'review_note'];
    const updates = [];
    const values = [];
    let i = 1;

    fields.forEach(f => {
        if (body[f] !== undefined) {
            updates.push(`${f} = $${i++}`);
            values.push(f === 'required_plan' ? normalizePlan(body[f]) : body[f]);
        }
    });

    let appliedStatus = null;
    if (body.status !== undefined) {
        const validStatuses = ['DRAFT', 'PENDING', 'PUBLISHED', 'REJECTED', 'ARCHIVED'];
        const newStatus = String(body.status).toUpperCase();
        if (!validStatuses.includes(newStatus)) throw createError('Invalid status', 400);
        if (['PUBLISHED', 'REJECTED', 'ARCHIVED'].includes(newStatus) && !isAdminUser(req.user)) {
            throw createError('Only admins can set this status', 403);
        }
        if (['DRAFT', 'PENDING'].includes(newStatus) || isAdminUser(req.user)) {
            updates.push(`status = $${i++}`);
            values.push(newStatus);
            appliedStatus = newStatus;
        }
    }

    if (!updates.length) throw createError('No fields to update', 400);
    updates.push(`updated_at = NOW()`);
    values.push(id);

    await query(`UPDATE courses SET ${updates.join(',')} WHERE id = $${i}`, values);

    // Notify the instructor when an admin sends a course back to Draft (or rejects) with a reason.
    const { instructor_id: instructorId, title } = existing.rows[0];
    const reason = (body.reviewNote || body.reason || '').trim();
    if (isAdminUser(req.user) && instructorId !== req.user.id && ['DRAFT', 'REJECTED'].includes(appliedStatus)) {
        const movedToDraft = appliedStatus === 'DRAFT';
        const message = movedToDraft
            ? `Your course "${title}" was moved back to Draft.${reason ? ` Reason: ${reason}` : ''}`
            : `Your course "${title}" was rejected.${reason ? ` Reason: ${reason}` : ' Please review our guidelines.'}`;
        await query(
            `INSERT INTO notifications (user_id, message, type, link) VALUES ($1, $2, $3, $4)`,
            [instructorId, message, movedToDraft ? 'info' : 'error', '/instructor/courses']
        ).catch(() => { });
        await query(
            `INSERT INTO audit_logs (user_id, action, resource, resource_id, details) VALUES ($1,$2,$3,$4,$5)`,
            [req.user.id, movedToDraft ? 'COURSE_MOVED_TO_DRAFT' : 'COURSE_REJECTED', 'courses', id, JSON.stringify({ reason })]
        ).catch(() => { });
    }

    const result = await query(
        `SELECT ${courseFields} FROM courses c JOIN users u ON c.instructor_id = u.id LEFT JOIN categories cat ON c.category_id = cat.id ${courseJoins} WHERE c.id = $1`,
        [id]
    );
    res.json(mapCourse(result.rows[0]));
};

// PUT /api/courses/:id/approve
const approve = async (req, res) => {
    await assertCourseInScope(req, req.params.id);
    const result = await query(
        `UPDATE courses SET status = 'PUBLISHED', updated_at = NOW() WHERE id = $1 RETURNING id, title, status, instructor_id`,
        [req.params.id]
    );
    if (!result.rows.length) throw createError('Course not found', 404);
    const course = result.rows[0];
    await query(
        `INSERT INTO audit_logs (user_id, action, resource, resource_id) VALUES ($1,$2,$3,$4)`,
        [req.user.id, 'COURSE_APPROVED', 'courses', req.params.id]
    ).catch(() => { });
    await query(
        `INSERT INTO notifications (user_id, message, type, link) VALUES ($1, $2, $3, $4)`,
        [course.instructor_id, `Your course "${course.title}" has been approved and published!`, 'approval', '/instructor/courses']
    ).catch(() => { });
    res.json(course);
};

// PUT /api/courses/:id/reject
const reject = async (req, res) => {
    await assertCourseInScope(req, req.params.id);
    const result = await query(
        `UPDATE courses SET status = 'REJECTED', updated_at = NOW() WHERE id = $1 RETURNING id, title, status, instructor_id`,
        [req.params.id]
    );
    if (!result.rows.length) throw createError('Course not found', 404);
    const course = result.rows[0];
    await query(
        `INSERT INTO audit_logs (user_id, action, resource, resource_id) VALUES ($1,$2,$3,$4)`,
        [req.user.id, 'COURSE_REJECTED', 'courses', req.params.id]
    ).catch(() => { });
    await query(
        `INSERT INTO notifications (user_id, message, type, link) VALUES ($1, $2, $3, $4)`,
        [course.instructor_id, `Your course "${course.title}" has been rejected. Please review our guidelines.`, 'error', '/instructor/courses']
    ).catch(() => { });
    res.json(course);
};

// DELETE /api/courses/:id
const deleteCourse = async (req, res) => {
    const existing = await query('SELECT instructor_id, title FROM courses WHERE id = $1', [req.params.id]);
    if (!existing.rows.length) throw createError('Course not found', 404);
    if (req.user.role === 'INSTRUCTOR' && existing.rows[0].instructor_id !== req.user.id) {
        throw createError('Not your course', 403);
    }
    await query('DELETE FROM courses WHERE id = $1', [req.params.id]);

    await query(
        `INSERT INTO audit_logs (user_id, action, resource, resource_id, details) VALUES ($1,$2,$3,$4,$5)`,
        [req.user.id, 'COURSE_DELETED', 'courses', req.params.id,
         JSON.stringify({ title: existing.rows[0].title })]
    ).catch(() => {});

    res.json({ success: true });
};

// POST /api/courses/:id/sections
const createSection = async (req, res) => {
    await assertCourseOwnership(req, req.params.id);
    const { title, order = 1 } = req.body;
    if (!title) throw createError('Section title is required', 400);
    const result = await query(
        `INSERT INTO sections (course_id, title, "order") VALUES ($1,$2,$3) RETURNING *`,
        [req.params.id, title, order]
    );
    res.status(201).json(result.rows[0]);
};

// PUT /api/courses/sections/:id
const updateSection = async (req, res) => {
    await assertSectionOwnership(req, req.params.id);
    const { title, order } = req.body;
    const result = await query(
        `UPDATE sections SET title = COALESCE($1, title), "order" = COALESCE($2, "order"), updated_at = NOW() WHERE id = $3 RETURNING *`,
        [title, order, req.params.id]
    );
    if (!result.rows.length) throw createError('Section not found', 404);
    res.json(result.rows[0]);
};

// DELETE /api/courses/sections/:id
const deleteSection = async (req, res) => {
    const sec = await query('SELECT title, course_id FROM sections WHERE id = $1', [req.params.id]);
    if (!sec.rows.length) throw createError('Section not found', 404);
    await assertSectionOwnership(req, req.params.id);
    // Cascading lesson deletes only SET NULL on quizzes — clean them up explicitly
    await query(
        'DELETE FROM quizzes WHERE lesson_id IN (SELECT id FROM lessons WHERE section_id = $1)',
        [req.params.id]
    ).catch(() => { });
    await query('DELETE FROM sections WHERE id = $1', [req.params.id]);

    await query(
        `INSERT INTO audit_logs (user_id, action, resource, resource_id, details) VALUES ($1,$2,$3,$4,$5)`,
        [req.user.id, 'SECTION_DELETED', 'sections', req.params.id,
         JSON.stringify({ sectionTitle: sec.rows[0].title, courseId: sec.rows[0].course_id })]
    ).catch(() => {});

    res.json({ success: true });
};

// POST /api/courses/:id/lessons
const createLesson = async (req, res) => {
    const { section_id, sectionId, title, type = 'video', content_url = '', contentUrl = '', duration = '', preview = false, order = 1 } = req.body;
    const finalSectionId = section_id || sectionId;
    const finalContentUrl = content_url || contentUrl;
    if (!finalSectionId || !title) throw createError('section_id and title are required', 400);
    await assertCourseOwnership(req, req.params.id);
    // The section must belong to the same course the lesson is being added to.
    const section = await query('SELECT course_id FROM sections WHERE id = $1', [finalSectionId]);
    if (!section.rows.length || section.rows[0].course_id !== req.params.id) {
        throw createError('Section does not belong to this course', 400);
    }
    const result = await query(
        `INSERT INTO lessons (section_id, course_id, title, type, content_url, duration, preview, "order")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [finalSectionId, req.params.id, title, type, finalContentUrl, duration, preview, order]
    );
    res.status(201).json(result.rows[0]);
};

// PUT /api/courses/lessons/:id
const updateLesson = async (req, res) => {
    const { title, type, content_url, contentUrl, duration, preview, order } = req.body;
    const { id } = req.params;

    await assertLessonOwnership(req, id);

    const updates = [];
    const values = [];
    let i = 1;

    // '' is a legitimate value (clearing content), so don't use || here
    const finalUrl = content_url !== undefined ? content_url : contentUrl;
    const fields = { title, type, content_url: finalUrl, duration, preview, "order": order };
    for (const [key, val] of Object.entries(fields)) {
        if (val !== undefined) {
            updates.push(`"${key}" = $${i++}`);
            values.push(val);
        }
    }

    if (!updates.length) throw createError('No fields to update', 400);
    values.push(id);

    const result = await query(
        `UPDATE lessons SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${i} RETURNING *`,
        values
    );

    if (!result.rows.length) throw createError('Lesson not found', 404);

    // If the lesson is no longer a quiz, remove any quiz that was attached to it
    if (type !== undefined && type !== 'quiz') {
        await query('DELETE FROM quizzes WHERE lesson_id = $1', [id]).catch(() => { });
    }

    res.json(result.rows[0]);
};

// DELETE /api/courses/lessons/:id
const deleteLesson = async (req, res) => {
    const ls = await query('SELECT title, course_id FROM lessons WHERE id = $1', [req.params.id]);
    if (!ls.rows.length) throw createError('Lesson not found', 404);
    await assertLessonOwnership(req, req.params.id);
    // lesson_id FK is ON DELETE SET NULL — remove the attached quiz explicitly
    // so it doesn't linger as an orphan on the course.
    await query('DELETE FROM quizzes WHERE lesson_id = $1', [req.params.id]).catch(() => { });
    await query('DELETE FROM lessons WHERE id = $1', [req.params.id]);

    await query(
        `INSERT INTO audit_logs (user_id, action, resource, resource_id, details) VALUES ($1,$2,$3,$4,$5)`,
        [req.user.id, 'LESSON_DELETED', 'lessons', req.params.id,
         JSON.stringify({ lessonTitle: ls.rows[0].title, courseId: ls.rows[0].course_id })]
    ).catch(() => {});

    res.json({ success: true });
};

module.exports = { getAll, getById, getLessons, getByInstructor, create, update, approve, reject, deleteCourse, createSection, updateSection, deleteSection, createLesson, updateLesson, deleteLesson };
