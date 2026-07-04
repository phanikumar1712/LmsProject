const { query } = require('../db/pool');
const { createError } = require('../middleware/errorHandler');
const { mapCourse, normalizePlan } = require('../utils/formatters');

const courseFields = `
    c.id, c.title, c.description, c.short_desc, c.thumbnail, c.price, c.discount_price,
    c.level, c.language, c.tags, c.what_you_learn, c.requirements,
    c.status, c.rating, c.review_count, c.enrollment_count, c.duration,
    c.certificate, c.required_plan, c.created_at, c.updated_at,
    COALESCE((
        SELECT array_agg(sp.name ORDER BY spc.priority ASC)
        FROM subscription_plan_courses spc
        JOIN subscription_plans sp ON sp.id = spc.plan_id
        WHERE spc.course_id = c.id
    ), '{}'::text[]) as "accessiblePlans",
    (SELECT COUNT(*)::int FROM lessons l WHERE l.course_id = c.id) as "lessonsCount",
    u.id as "instructorId", u.name as "instructorName", u.avatar as "instructorAvatar", u.bio as "instructorBio",
    u.role as "instructorRole", u.earnings as "instructorEarnings", u.subscription_plan as "instructorPlan",
    u.created_at as "instructorJoined",
    cat.id as "categoryId", cat.name as "categoryName", cat.icon as "categoryIcon"
`;

const isAdminUser = (user) => user && ['ADMIN', 'SUPER_ADMIN'].includes(user.role);

const COURSE_UPDATE_ALIASES = {
    shortDesc: 'short_desc',
    discountPrice: 'discount_price',
    categoryId: 'category_id',
    requiredPlan: 'required_plan',
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
        if (!Number.isFinite(value)) throw createError(`Invalid ${field}`, 400);
        normalized[field] = value;
    });
    return normalized;
};

// GET /api/courses
const getAll = async (req, res) => {
    const { status, category, search, level, sort, limit = 50, offset = 0, admin } = req.query;
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

    if (category) { conditions.push(`cat.id = $${i++}`); values.push(category); }
    if (level) { conditions.push(`c.level = $${i++}`); values.push(level); }
    if (search) {
        conditions.push(`(c.title ILIKE $${i} OR u.name ILIKE $${i})`);
        values.push(`%${search}%`); i++;
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
         WHERE c.id = $1`,
        [req.params.id]
    );
    if (!result.rows.length) throw createError('Course not found', 404);
    res.json(mapCourse(result.rows[0]));
};

// GET /api/courses/:id/lessons
const getLessons = async (req, res) => {
    const { id: courseId } = req.params;

    const sectionsResult = await query(
        'SELECT * FROM sections WHERE course_id = $1 ORDER BY "order" ASC',
        [courseId]
    );
    const lessonsResult = await query(
        'SELECT * FROM lessons WHERE course_id = $1 ORDER BY "order" ASC',
        [courseId]
    );

    const sections = sectionsResult.rows.map(s => ({
        ...s,
        courseId: s.course_id,
        createdAt: s.created_at,
    }));

    const lessons = lessonsResult.rows.map(l => ({
        ...l,
        sectionId: l.section_id,
        courseId: l.course_id,
        contentUrl: l.content_url,
        createdAt: l.created_at,
    }));

    res.json({ sections, lessons });
};

// GET /api/courses/instructor/:instructorId
const getByInstructor = async (req, res) => {
    const result = await query(
        `SELECT ${courseFields} FROM courses c
         JOIN users u ON c.instructor_id = u.id
         LEFT JOIN categories cat ON c.category_id = cat.id
         WHERE c.instructor_id = $1
         ORDER BY c.created_at DESC`,
        [req.params.instructorId]
    );
    res.json(result.rows.map(mapCourse));
};

// POST /api/courses
const create = async (req, res) => {
    const {
        title, description, short_desc, shortDesc, thumbnail, price = 0, discount_price, discountPrice,
        level = 'Beginner', language = 'English', tags = [], what_you_learn = [], whatYouLearn,
        requirements = [], category_id, categoryId, duration = '0h', certificate = true,
        required_plan = 'FREE', requiredPlan, status: bodyStatus
    } = req.body;

    if (!title) throw createError('Title is required', 400);

    const allowedStatuses = ['DRAFT', 'PENDING'];
    const status = allowedStatuses.includes(String(bodyStatus || '').toUpperCase())
        ? String(bodyStatus).toUpperCase()
        : 'PENDING';

    const result = await query(
        `INSERT INTO courses (title, description, short_desc, instructor_id, category_id, thumbnail, price, discount_price, level, language, tags, what_you_learn, requirements, duration, certificate, required_plan, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
         RETURNING id`,
        [title, description, short_desc || shortDesc, req.user.id, category_id || categoryId || null, thumbnail,
            price, discount_price || discountPrice || null, level, language, tags, what_you_learn || whatYouLearn || [], requirements,
            duration, certificate, normalizePlan(required_plan || requiredPlan), status]
    );

    await query(
        `INSERT INTO audit_logs (user_id, action, resource, resource_id) VALUES ($1,$2,$3,$4)`,
        [req.user.id, 'COURSE_CREATED', 'courses', result.rows[0].id]
    ).catch(() => { });

    const course = await query(
        `SELECT ${courseFields} FROM courses c JOIN users u ON c.instructor_id = u.id LEFT JOIN categories cat ON c.category_id = cat.id WHERE c.id = $1`,
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

    const fields = ['title', 'description', 'short_desc', 'thumbnail', 'price', 'discount_price',
        'level', 'language', 'tags', 'what_you_learn', 'requirements', 'category_id', 'duration', 'certificate', 'required_plan'];
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
        `SELECT ${courseFields} FROM courses c JOIN users u ON c.instructor_id = u.id LEFT JOIN categories cat ON c.category_id = cat.id WHERE c.id = $1`,
        [id]
    );
    res.json(mapCourse(result.rows[0]));
};

// PUT /api/courses/:id/approve
const approve = async (req, res) => {
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
    const existing = await query('SELECT instructor_id FROM courses WHERE id = $1', [req.params.id]);
    if (!existing.rows.length) throw createError('Course not found', 404);
    if (req.user.role === 'INSTRUCTOR' && existing.rows[0].instructor_id !== req.user.id) {
        throw createError('Not your course', 403);
    }
    await query('DELETE FROM courses WHERE id = $1', [req.params.id]);
    res.json({ success: true });
};

// POST /api/courses/:id/sections
const createSection = async (req, res) => {
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
    await query('DELETE FROM sections WHERE id = $1', [req.params.id]);
    res.json({ success: true });
};

// POST /api/courses/:id/lessons
const createLesson = async (req, res) => {
    const { section_id, sectionId, title, type = 'video', content_url = '', contentUrl = '', duration = '', preview = false, order = 1 } = req.body;
    const finalSectionId = section_id || sectionId;
    const finalContentUrl = content_url || contentUrl;
    if (!finalSectionId || !title) throw createError('section_id and title are required', 400);
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

    const updates = [];
    const values = [];
    let i = 1;

    const fields = { title, type, content_url: content_url || contentUrl, duration, preview, "order": order };
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
    res.json(result.rows[0]);
};

// DELETE /api/courses/lessons/:id
const deleteLesson = async (req, res) => {
    await query('DELETE FROM lessons WHERE id = $1', [req.params.id]);
    res.json({ success: true });
};

module.exports = { getAll, getById, getLessons, getByInstructor, create, update, approve, reject, deleteCourse, createSection, updateSection, deleteSection, createLesson, updateLesson, deleteLesson };
