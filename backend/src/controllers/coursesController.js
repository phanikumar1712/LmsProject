const { query } = require('../db/pool');
const { createError } = require('../middleware/errorHandler');
const { mapCourse } = require('../utils/formatters');
const { getDepartmentScope } = require('../utils/scope');
const { getDeptCapacity, notifyLimitReached } = require('../utils/limits');
const { writeAudit } = require('../utils/audit');

const courseFields = `
    c.id, c.title, c.description, c.short_desc, c.thumbnail,
    c.level, c.language, c.tags, c.what_you_learn, c.requirements,
    c.status, c.rating, c.review_count, c.enrollment_count, c.duration,
    c.semester, c.certificate, c.review_note, c.created_at, c.updated_at,
    COALESCE(l_agg.lesson_count, 0)::int as "lessonsCount",
    COALESCE(sem_agg.semesters, '{}')::int[] as "semesters",
    COALESCE(yr_agg.years, '{}')::int[] as "years",
    u.id as "instructorId", u.name as "instructorName", u.avatar as "instructorAvatar", u.bio as "instructorBio",
    u.role as "instructorRole",
    u.created_at as "instructorJoined",
    cat.id as "categoryId", cat.name as "categoryName", cat.icon as "categoryIcon", cat.department_id as "departmentId",
    dept.name as "departmentName"
`;

// Many-to-many bucket aggregates (course_semesters / course_years) — one
// course can be copied into several semester/year buckets at once.
const bucketJoins = `
    LEFT JOIN LATERAL (
        SELECT COALESCE(array_agg(cs.semester ORDER BY cs.semester), '{}')::int[] AS semesters
        FROM course_semesters cs WHERE cs.course_id = c.id
    ) sem_agg ON true
    LEFT JOIN LATERAL (
        SELECT COALESCE(array_agg(cy.year ORDER BY cy.year), '{}')::int[] AS years
        FROM course_years cy WHERE cy.course_id = c.id
    ) yr_agg ON true
`;

// N+1 lateral join fragments.
const courseJoins = `
    LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS lesson_count
        FROM lessons l
        WHERE l.course_id = c.id
    ) l_agg ON true
`;

const isAdminUser = (user) => user && ['ADMIN', 'SUPER_ADMIN'].includes(user.role);

// Verify that the authenticated user owns the course that contains this section.
// Throws 404 if section doesn't exist, 403 if not authorized. Also enforces
// department scope for admins (course → category → department).
const assertSectionOwnership = async (req, sectionId) => {
    const result = await query(
        `SELECT c.instructor_id, c.id AS course_id FROM sections s
         JOIN courses c ON s.course_id = c.id
         WHERE s.id = $1`,
        [sectionId]
    );
    if (!result.rows.length) throw createError('Section not found', 404);
    if (req.user.role === 'INSTRUCTOR' && result.rows[0].instructor_id !== req.user.id) {
        throw createError('Not authorized to modify this section', 403);
    }
    if (req.user.role === 'ADMIN') await assertCourseInScope(req, result.rows[0].course_id);
};

// Verify that the authenticated user owns the course that contains this lesson.
// Throws 404 if lesson doesn't exist, 403 if not authorized. Also enforces
// department scope for admins (course → category → department).
const assertLessonOwnership = async (req, lessonId) => {
    const result = await query(
        `SELECT c.instructor_id, c.id AS course_id FROM lessons l
         JOIN courses c ON l.course_id = c.id
         WHERE l.id = $1`,
        [lessonId]
    );
    if (!result.rows.length) throw createError('Lesson not found', 404);
    if (req.user.role === 'INSTRUCTOR' && result.rows[0].instructor_id !== req.user.id) {
        throw createError('Not authorized to modify this lesson', 403);
    }
    if (req.user.role === 'ADMIN') await assertCourseInScope(req, result.rows[0].course_id);
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
// (via the denormalized courses.department_id column, kept in sync with the
// course's category by DB triggers). Throws 403 on cross-department access.
// NOTE: this duplicates utils/courseAuth.assertCourseInScope. Kept local so
// courses_limits.test.js (which only invalidates coursesController + limits in
// require.cache) keeps working — courseAuth would hold a stale fake-pool query.
const assertCourseInScope = async (req, courseId) => {
    const { scoped, departmentId } = getDepartmentScope(req);
    if (!scoped) return;
    const r = await query(
        `SELECT department_id FROM courses WHERE id = $1`,
        [courseId]
    );
    if (!r.rows.length) throw createError('Course not found', 404);
    if (r.rows[0].department_id !== departmentId) {
        throw createError('This course is outside your department', 403);
    }
};

const COURSE_UPDATE_ALIASES = {
    shortDesc: 'short_desc',
    categoryId: 'category_id',
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
    // Price, discount_price, and required_plan are no longer used
    delete normalized.price;
    delete normalized.discount_price;
    delete normalized.discountPrice;
    delete normalized.required_plan;
    delete normalized.requiredPlan;
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
        const deptParam = `$${i++}`;
        // Only courses whose department matches the admin's own. The column is
        // kept in sync with the category by DB triggers (uncategorized courses
        // fall back to the instructor's department), so it covers both branches
        // the old category/instructor derivation handled.
        conditions.push(`c.department_id = ${deptParam}`);
        values.push(departmentId);
    } else if (adminView && qDepartmentId) {
        // SUPER_ADMIN can filter courses by a specific department
        conditions.push(`c.department_id = $${i++}`);
        values.push(qDepartmentId);
    } else if (!adminView && req.user && req.user.role === 'STUDENT' && req.user.department_id) {
        // STUDENT catalog isolation: only courses belonging to the student's
        // department (plus global courses with no department at all) are listed.
        // Mirrors the enroll() check — anything shown in the catalog must be
        // enrollable. Courses owned by other departments (ECE, Mechanical, ...)
        // are invisible even though the endpoint is public.
        const deptParam = `$${i++}`;
        conditions.push(`(c.department_id IS NULL OR c.department_id = ${deptParam})`);
        values.push(req.user.department_id);
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
    // Price sort is no longer relevant — all courses are free
    if (sort === 'newest') orderBy = 'c.created_at DESC';

    const { getPagination } = require('../utils/pagination');

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countSql = `
        SELECT COUNT(*)::int as total
        FROM courses c
        LEFT JOIN users u ON c.instructor_id = u.id
        LEFT JOIN categories cat ON c.category_id = cat.id
        LEFT JOIN departments dept ON cat.department_id = dept.id
        ${where}
    `;
    const countResult = await query(countSql, values);

    // Get paginated data
    const sql = `
        SELECT ${courseFields}
        FROM courses c
        LEFT JOIN users u ON c.instructor_id = u.id
        LEFT JOIN categories cat ON c.category_id = cat.id
        LEFT JOIN departments dept ON cat.department_id = dept.id
        ${courseJoins}
        ${bucketJoins}
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
         LEFT JOIN users u ON c.instructor_id = u.id
         LEFT JOIN categories cat ON c.category_id = cat.id         LEFT JOIN departments dept ON cat.department_id = dept.id
         ${courseJoins}
         ${bucketJoins}
         WHERE c.id = $1`,
        [req.params.id]


    );
    if (!result.rows.length) throw createError('Course not found', 404);
    res.json(mapCourse(result.rows[0]));
};

// GET /api/courses/:id/lessons
const getLessons = async (req, res) => {
    const { id: courseId } = req.params;

    // Validate the course exists before querying sections.
    const courseCheck = await query('SELECT id FROM courses WHERE id = $1', [courseId]);
    if (!courseCheck.rows.length) throw createError('Course not found', 404);

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

    // Determine whether the caller has full access to content URLs.
    // Full access is granted to: admins, the course instructor, or enrolled students.
    const user = req.user; // set by optionalAuth if token present
    let fullAccess = false;
    if (user) {
        if (user.role === 'SUPER_ADMIN') {
            fullAccess = true;
        } else if (user.role === 'ADMIN') {
            if (!user.department_id) {
                fullAccess = true;
            } else {
                const r = await query(
                    `SELECT department_id FROM courses WHERE id = $1`,
                    [courseId]
                );
                if (r.rows.length && r.rows[0].department_id === user.department_id) {
                    fullAccess = true;
                }
            }
        } else {
            // Check if user is the course instructor
            const courseRow = await query('SELECT instructor_id FROM courses WHERE id = $1', [courseId]);
            if (courseRow.rows.length && courseRow.rows[0].instructor_id === user.id) {
                fullAccess = true;
            } else {
                // Check if user is enrolled in this course
                const enrollRow = await query(
                    'SELECT id FROM enrollments WHERE student_id = $1 AND course_id = $2 LIMIT 1',
                    [user.id, courseId]
                );
                if (enrollRow.rows.length) fullAccess = true;
            }
        }
    }

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
            // Only expose content_url for preview lessons or users with full access
            const showUrl = fullAccess || row.preview;
            lessons.push({
                id: row.id,
                section_id: row.section_id,
                course_id: row.course_id,
                title: row.title,
                type: row.type,
                content_url: showUrl ? row.content_url : null,
                duration: row.duration,
                preview: row.preview,
                order: row.order,
                created_at: row.created_at,
                sectionId: row.section_id,
                courseId: row.course_id,
                contentUrl: showUrl ? row.content_url : null,
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
         LEFT JOIN users u ON c.instructor_id = u.id
         LEFT JOIN categories cat ON c.category_id = cat.id
         LEFT JOIN departments dept ON cat.department_id = dept.id
         ${courseJoins}
         ${bucketJoins}
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
        title, description, short_desc, shortDesc, thumbnail,
        level = 'Beginner', language = 'English', tags = [], what_you_learn = [], whatYouLearn,
        requirements = [], category_id, categoryId, duration = '0h', certificate = true,
        status: bodyStatus, custom_category, customCategory
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
        `INSERT INTO courses (title, description, short_desc, instructor_id, category_id, thumbnail, level, language, tags, what_you_learn, requirements, duration, certificate, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         RETURNING id`,
        [title, description, short_desc || shortDesc, req.user.id, finalCategoryId, thumbnail,
            level, language, tags, what_you_learn || whatYouLearn || [], requirements,
            duration, certificate, status]
    );

    await query(
        `INSERT INTO audit_logs (user_id, action, resource, resource_id) VALUES ($1,$2,$3,$4)`,
        [req.user.id, 'COURSE_CREATED', 'courses', result.rows[0].id]
    ).catch(() => { });

    const course = await query(
        `SELECT ${courseFields} FROM courses c LEFT JOIN users u ON c.instructor_id = u.id LEFT JOIN categories cat ON c.category_id = cat.id LEFT JOIN departments dept ON cat.department_id = dept.id ${courseJoins} ${bucketJoins} WHERE c.id = $1`,
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
    // Department-scoped admins may only edit courses in their own department.
    if (req.user.role === 'ADMIN') await assertCourseInScope(req, id);
    // Only resolve/create a custom category after ownership is confirmed
    if (!body.category_id && (body.custom_category || body.customCategory)) {
        body.category_id = await resolveCustomCategory(body.custom_category || body.customCategory);
    }

    const fields = ['title', 'description', 'short_desc', 'thumbnail',
        'level', 'language', 'tags', 'what_you_learn', 'requirements', 'category_id', 'duration', 'certificate', 'semester',
        'start_date', 'end_date', 'review_level', 'review_note'];
    const updates = [];
    const values = [];
    let i = 1;

    fields.forEach(f => {
        if (body[f] !== undefined) {
            updates.push(`${f} = $${i++}`);
            values.push(body[f]);
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
        `SELECT ${courseFields} FROM courses c LEFT JOIN users u ON c.instructor_id = u.id LEFT JOIN categories cat ON c.category_id = cat.id LEFT JOIN departments dept ON cat.department_id = dept.id ${courseJoins} ${bucketJoins} WHERE c.id = $1`,
        [id]
    );
    res.json(mapCourse(result.rows[0]));
};

// Resolve the department a course belongs to (courses.department_id — kept in
// sync with the category, falling back to the instructor's department when the
// course is uncategorized). Returns null for globally-scoped courses.
const resolveCourseDepartment = async (courseId) => {
    const r = await query(
        'SELECT department_id FROM courses WHERE id = $1',
        [courseId]
    );
    return r.rows.length ? r.rows[0].department_id : null;
};

// PUT /api/courses/:id/approve
const approve = async (req, res) => {
    await assertCourseInScope(req, req.params.id);

    // Department course-limit enforcement: if the department has already reached
    // its max_courses quota, block the approval and notify the dept admins + a
    // super admin for a limit-review discussion.
    const departmentId = await resolveCourseDepartment(req.params.id);
    if (departmentId) {
        const capacity = await getDeptCapacity(departmentId);
        if (capacity.coursesAtLimit) {
            await notifyLimitReached(departmentId, 'courses');
            throw createError(
                `Course limit reached: this department has ${capacity.courseCount} courses and the limit is ${capacity.maxCourses}. You can't approve more courses until a Super Admin raises the limit.`,
                409
            );
        }
    }

    const result = await query(
        `UPDATE courses SET status = 'PUBLISHED', review_note = '', updated_at = NOW() WHERE id = $1 RETURNING id, title, status, instructor_id`,
        [req.params.id]
    );
    if (!result.rows.length) throw createError('Course not found', 404);
    const course = result.rows[0];
    await query(
        `INSERT INTO audit_logs (user_id, action, resource, resource_id) VALUES ($1,$2,$3,$4)`,
        [req.user.id, 'COURSE_APPROVED', 'courses', req.params.id]
    ).catch(() => { });
    if (course.instructor_id) {
        await query(
            `INSERT INTO notifications (user_id, message, type, link) VALUES ($1, $2, $3, $4)`,
            [course.instructor_id, `Your course "${course.title}" has been approved and published! 🎉`, 'approval', '/instructor/courses']
        ).catch(() => { });
    }
    res.json(course);
};

// PUT /api/courses/:id/reject — persists the rejection reason (review_note) so
// the instructor sees exactly why the course was rejected, and includes it in
// the notification + audit log.
const reject = async (req, res) => {
    await assertCourseInScope(req, req.params.id);
    const reason = (req.body.reason || req.body.reviewNote || '').trim();
    const result = await query(
        `UPDATE courses SET status = 'REJECTED', review_note = $2, updated_at = NOW() WHERE id = $1 RETURNING id, title, status, instructor_id`,
        [req.params.id, reason]
    );
    if (!result.rows.length) throw createError('Course not found', 404);
    const course = result.rows[0];
    await query(
        `INSERT INTO audit_logs (user_id, action, resource, resource_id, details) VALUES ($1,$2,$3,$4,$5)`,
        [req.user.id, 'COURSE_REJECTED', 'courses', req.params.id, JSON.stringify({ reason })]
    ).catch(() => { });
    const message = reason
        ? `Your course "${course.title}" was rejected. Reason: ${reason}`
        : `Your course "${course.title}" was rejected. Please review our guidelines.`;
    if (course.instructor_id) {
        await query(
            `INSERT INTO notifications (user_id, message, type, link) VALUES ($1, $2, $3, $4)`,
            [course.instructor_id, message, 'error', '/instructor/courses']
        ).catch(() => { });
    }
    res.json(course);
};

// DELETE /api/courses/:id
const deleteCourse = async (req, res) => {
    const existing = await query('SELECT instructor_id, title FROM courses WHERE id = $1', [req.params.id]);
    if (!existing.rows.length) throw createError('Course not found', 404);
    if (req.user.role === 'INSTRUCTOR' && existing.rows[0].instructor_id !== req.user.id) {
        throw createError('Not your course', 403);
    }
    // Department-scoped admins may only delete courses in their own department.
    if (req.user.role === 'ADMIN') await assertCourseInScope(req, req.params.id);
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
    // Department-scoped admins may only add sections to in-scope courses.
    if (req.user.role === 'ADMIN') await assertCourseInScope(req, req.params.id);
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
    ).catch(err => console.error('[course] quiz cleanup failed on section delete:', err.message));
    await query('DELETE FROM sections WHERE id = $1', [req.params.id]);

    await query(
        `INSERT INTO audit_logs (user_id, action, resource, resource_id, details) VALUES ($1,$2,$3,$4,$5)`,
        [req.user.id, 'SECTION_DELETED', 'sections', req.params.id,
         JSON.stringify({ sectionTitle: sec.rows[0].title, courseId: sec.rows[0].course_id })]
    ).catch(() => {});

    res.json({ success: true });
};

// PUT /api/courses/:id/sections/reorder — bulk-reorder a course's sections.
// Body: { sectionIds: [...] } in the desired order. All sections must belong
// to the course (verified), then "order" = array position + 1 in one batch.
const reorderSections = async (req, res) => {
    const { sectionIds } = req.body;
    if (!Array.isArray(sectionIds) || !sectionIds.length) throw createError('sectionIds must be a non-empty array', 400);

    await assertCourseOwnership(req, req.params.id);
    if (req.user.role === 'ADMIN') await assertCourseInScope(req, req.params.id);

    const safe = [...new Set(sectionIds.map(String))];
    const owned = await query(
        `SELECT id FROM sections WHERE course_id = $1 AND id = ANY($2::uuid[])`,
        [req.params.id, safe]
    );
    const ownedIds = new Set(owned.rows.map(r => r.id));
    const foreign = safe.filter(id => !ownedIds.has(id));
    if (foreign.length) throw createError('One or more sections do not belong to this course', 400);

    // One batched UPDATE: order = position in the array + 1.
    const result = await query(`
        UPDATE sections s SET "order" = t.pos, updated_at = NOW()
        FROM unnest($1::uuid[]) WITH ORDINALITY AS t(id, pos)
        WHERE s.id = t.id
    `, [safe]);

    await query(
        `INSERT INTO audit_logs (user_id, action, resource, resource_id, details) VALUES ($1,$2,$3,$4,$5)`,
        [req.user.id, 'SECTIONS_REORDERED', 'courses', req.params.id,
         JSON.stringify({ sectionIds: safe })]
    ).catch(() => { });

    res.json({ success: true, reordered: result.rowCount });
};

// PUT /api/courses/sections/:id/lessons/reorder — bulk-reorder a section's
// lessons. Body: { lessonIds: [...] } in the desired order.
const reorderLessons = async (req, res) => {
    const { lessonIds } = req.body;
    if (!Array.isArray(lessonIds) || !lessonIds.length) throw createError('lessonIds must be a non-empty array', 400);

    await assertSectionOwnership(req, req.params.id);

    const safe = [...new Set(lessonIds.map(String))];
    const owned = await query(
        `SELECT id FROM lessons WHERE section_id = $1 AND id = ANY($2::uuid[])`,
        [req.params.id, safe]
    );
    const ownedIds = new Set(owned.rows.map(r => r.id));
    const foreign = safe.filter(id => !ownedIds.has(id));
    if (foreign.length) throw createError('One or more lessons do not belong to this section', 400);

    const result = await query(`
        UPDATE lessons l SET "order" = t.pos, updated_at = NOW()
        FROM unnest($1::uuid[]) WITH ORDINALITY AS t(id, pos)
        WHERE l.id = t.id
    `, [safe]);

    await query(
        `INSERT INTO audit_logs (user_id, action, resource, resource_id, details) VALUES ($1,$2,$3,$4,$5)`,
        [req.user.id, 'LESSONS_REORDERED', 'sections', req.params.id,
         JSON.stringify({ lessonIds: safe })]
    ).catch(() => { });

    res.json({ success: true, reordered: result.rowCount });
};

// PUT /api/courses/lessons/:id/move — move a lesson into another section (or to
// a new position within its own section). Body: { sectionId, order? } where
// order is the 1-based target position (defaults to append at end). Both
// sections must belong to the same course. Positions are renumbered in a single
// transaction so a crash can't leave gaps or duplicates.
const moveLesson = async (req, res) => {
    const { sectionId, order } = req.body;
    const { id: lessonId } = req.params;
    if (!sectionId) throw createError('sectionId is required', 400);

    await assertLessonOwnership(req, lessonId);

    const lesson = await query(
        `SELECT l.section_id, l."order", l.title, l.course_id FROM lessons l WHERE l.id = $1`,
        [lessonId]
    );
    if (!lesson.rows.length) throw createError('Lesson not found', 404);
    const fromSectionId = lesson.rows[0].section_id;
    const fromOrder = lesson.rows[0].order;

    const target = await query(
        `SELECT s.course_id,
                (SELECT COUNT(*)::int FROM lessons l WHERE l.section_id = s.id) AS lesson_count
         FROM sections s WHERE s.id = $1`,
        [sectionId]
    );
    if (!target.rows.length) throw createError('Section not found', 404);
    if (target.rows[0].course_id !== lesson.rows[0].course_id) {
        throw createError('Cannot move a lesson to a section in a different course', 400);
    }

    const sameSection = fromSectionId === sectionId;
    const targetCount = target.rows[0].lesson_count;
    // Same-section moves clamp to [1, targetCount] (the lesson already occupies a
    // slot); cross-section moves to [1, targetCount + 1] (it appends a new slot).
    const maxOrder = sameSection ? targetCount : targetCount + 1;
    let newOrder = parseInt(order, 10);
    if (!Number.isInteger(newOrder) || newOrder < 1) newOrder = maxOrder;
    if (newOrder > maxOrder) newOrder = maxOrder;

    const client = await query.pool.connect();
    let moved;
    try {
        await client.query('BEGIN');
        if (sameSection) {
            // Close the gap at the old position, then open a slot at the new one.
            if (newOrder > fromOrder) {
                await client.query(
                    `UPDATE lessons SET "order" = "order" - 1
                     WHERE section_id = $1 AND "order" > $2 AND "order" <= $3`,
                    [fromSectionId, fromOrder, newOrder]
                );
            } else if (newOrder < fromOrder) {
                await client.query(
                    `UPDATE lessons SET "order" = "order" + 1
                     WHERE section_id = $1 AND "order" >= $2 AND "order" < $3`,
                    [fromSectionId, newOrder, fromOrder]
                );
            }
        } else {
            // Remove from the source section and insert into the target.
            await client.query(
                `UPDATE lessons SET "order" = "order" - 1 WHERE section_id = $1 AND "order" > $2`,
                [fromSectionId, fromOrder]
            );
            await client.query(
                `UPDATE lessons SET "order" = "order" + 1 WHERE section_id = $1 AND "order" >= $2`,
                [sectionId, newOrder]
            );
        }
        const result = await client.query(
            `UPDATE lessons SET section_id = $1, "order" = $2, updated_at = NOW() WHERE id = $3 RETURNING *`,
            [sectionId, newOrder, lessonId]
        );
        moved = result.rows[0];
        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }

    await query(
        `INSERT INTO audit_logs (user_id, action, resource, resource_id, details) VALUES ($1,$2,$3,$4,$5)`,
        [req.user.id, 'LESSON_MOVED', 'lessons', lessonId,
         JSON.stringify({ lessonTitle: lesson.rows[0].title, fromSectionId, toSectionId: sectionId, order: newOrder })]
    ).catch(() => {});

    res.json(moved);
};

// POST /api/courses/:id/lessons
const createLesson = async (req, res) => {
    const { section_id, sectionId, title, type = 'video', content_url = '', contentUrl = '', duration = '', preview = false, order = 1 } = req.body;
    const finalSectionId = section_id || sectionId;
    const finalContentUrl = content_url || contentUrl;
    if (!finalSectionId || !title) throw createError('section_id and title are required', 400);
    await assertCourseOwnership(req, req.params.id);
    // Department-scoped admins may only add lessons to in-scope courses.
    if (req.user.role === 'ADMIN') await assertCourseInScope(req, req.params.id);
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
        await query('DELETE FROM quizzes WHERE lesson_id = $1', [id]).catch(err => console.error('[course] quiz cleanup failed on lesson update:', err.message));
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
    await query('DELETE FROM quizzes WHERE lesson_id = $1', [req.params.id]).catch(err => console.error('[course] quiz cleanup failed on lesson delete:', err.message));
    await query('DELETE FROM lessons WHERE id = $1', [req.params.id]);

    await query(
        `INSERT INTO audit_logs (user_id, action, resource, resource_id, details) VALUES ($1,$2,$3,$4,$5)`,
        [req.user.id, 'LESSON_DELETED', 'lessons', req.params.id,
         JSON.stringify({ lessonTitle: ls.rows[0].title, courseId: ls.rows[0].course_id })]
    ).catch(() => {});

    res.json({ success: true });
};

// PUT /api/courses/:id/publish — set a course to PUBLISHED (super admin / in-scope
// admin). Used for the explicit "Publish" action in course management. Unlike
// approve (which enforces the department course quota), publish is an operator
// override — it still notifies the instructor and writes an audit trail.
const publish = async (req, res) => {
    await assertCourseInScope(req, req.params.id);
    const result = await query(
        `UPDATE courses SET status = 'PUBLISHED', review_note = '', updated_at = NOW() WHERE id = $1 RETURNING id, title, instructor_id`,
        [req.params.id]
    );
    if (!result.rows.length) throw createError('Course not found', 404);
    const course = result.rows[0];
    await query(
        `INSERT INTO audit_logs (user_id, action, resource, resource_id) VALUES ($1,$2,$3,$4)`,
        [req.user.id, 'COURSE_PUBLISHED', 'courses', req.params.id]
    ).catch(() => { });
    await query(
        `INSERT INTO notifications (user_id, message, type, link) VALUES ($1, $2, $3, $4)`,
        [course.instructor_id, `Your course "${course.title}" has been published! 🎉`, 'approval', '/instructor/courses']
    ).catch(() => { });
    res.json({ success: true, id: course.id, status: 'PUBLISHED' });
};

// PUT /api/courses/:id/unpublish — move a course back to DRAFT (hidden from the
// catalog). Notifies the instructor and writes an audit trail.
const unpublish = async (req, res) => {
    await assertCourseInScope(req, req.params.id);
    const result = await query(
        `UPDATE courses SET status = 'DRAFT', updated_at = NOW() WHERE id = $1 RETURNING id, title, instructor_id`,
        [req.params.id]
    );
    if (!result.rows.length) throw createError('Course not found', 404);
    const course = result.rows[0];
    await query(
        `INSERT INTO audit_logs (user_id, action, resource, resource_id) VALUES ($1,$2,$3,$4)`,
        [req.user.id, 'COURSE_UNPUBLISHED', 'courses', req.params.id]
    ).catch(() => { });
    await query(
        `INSERT INTO notifications (user_id, message, type, link) VALUES ($1, $2, $3, $4)`,
        [course.instructor_id, `Your course "${course.title}" was unpublished and is no longer visible to students.`, 'warning', '/instructor/courses']
    ).catch(() => { });
    res.json({ success: true, id: course.id, status: 'DRAFT' });
};

// PUT /api/courses/:id/instructor — reassign a course to a different instructor
// (super admin; dept-scoped admins may only move courses within their department).
const assignInstructor = async (req, res) => {
    const { instructorId } = req.body;
    // null (or omitted) means "unassign" — remove the course from the instructor.
    const newInstructorId = instructorId == null ? null : instructorId;
    if (instructorId === undefined) throw createError('instructorId is required (pass null to unassign)', 400);

    await assertCourseInScope(req, req.params.id);

    let instructorName = null;
    if (newInstructorId) {
        const instructor = await query(
            `SELECT id, name, department_id FROM users WHERE id = $1 AND role = 'INSTRUCTOR'`,
            [newInstructorId]
        );
        if (!instructor.rows.length) throw createError('Instructor not found', 404);

        // Scoped admins cannot move a course to an instructor outside their department.
        const { scoped, departmentId } = getDepartmentScope(req);
        if (scoped && instructor.rows[0].department_id !== departmentId) {
            throw createError('Cannot assign this course to an instructor outside your department', 403);
        }
        instructorName = instructor.rows[0].name;
    }

    const result = await query(
        `UPDATE courses SET instructor_id = $1, updated_at = NOW() WHERE id = $2 RETURNING id, title, instructor_id`,
        [newInstructorId, req.params.id]
    );
    if (!result.rows.length) throw createError('Course not found', 404);

    await query(
        `INSERT INTO audit_logs (user_id, action, resource, resource_id, details) VALUES ($1,$2,$3,$4,$5)`,
        [req.user.id, 'COURSE_INSTRUCTOR_ASSIGNED', 'courses', req.params.id,
         JSON.stringify({ courseTitle: result.rows[0].title, instructorId: newInstructorId, instructorName })]
    ).catch(() => { });
    if (newInstructorId) {
        await query(
            `INSERT INTO notifications (user_id, message, type, link) VALUES ($1, $2, $3, $4)`,
            [newInstructorId, `Course "${result.rows[0].title}" has been assigned to you.`, 'info', '/instructor/courses']
        ).catch(() => { });
    }

    res.json({ success: true, id: result.rows[0].id, instructorId: result.rows[0].instructor_id });
};

// ── BULK COURSE IMPORT ──────────────────────────────────────────────────────
// Columns (case-insensitive): title (required), instructor (email or name,
// optional → defaults to the importing admin), department (name, optional),
// category (name, optional → created if missing), level, duration, description.
// Scoped admins are locked to their own department; SUPER_ADMINs may import
// across departments via the Department column. Courses are created as DRAFT
// so nothing goes live without the normal admin review/approval flow.

const MAX_COURSE_IMPORT_ROWS = 500;

const parseCourseSheet = (req) => {
    if (!req.file || !req.file.buffer) throw createError('No file uploaded', 400);
    const xlsx = require('xlsx');
    let rows;
    try {
        const wb = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });
    } catch {
        throw createError('Could not parse file. Upload a valid CSV or Excel file.', 400);
    }
    if (!rows.length) throw createError('The file has no rows', 400);
    if (rows.length > MAX_COURSE_IMPORT_ROWS) throw createError(`File exceeds maximum of ${MAX_COURSE_IMPORT_ROWS} rows`, 400);
    return rows;
};

const pickCell = (row, key) => {
    const found = Object.keys(row).find(k => k.trim().toLowerCase() === key);
    return found ? row[found] : '';
};

// Resolve the department for each row by name. Scoped admins are locked to
// their own department (a mismatched Department column is a per-row error).
const resolveCourseDepartments = async (req, rows) => {
    const { scoped, departmentId } = getDepartmentScope(req);
    const deptNames = [...new Set(
        rows.map(r => String(pickCell(r, 'department') || '').trim().toLowerCase()).filter(Boolean)
    )];
    const deptMap = new Map();
    if (deptNames.length) {
        const res = await query('SELECT id, name FROM departments WHERE LOWER(name) = ANY($1::text[])', [deptNames]);
        res.rows.forEach(d => deptMap.set(d.name.toLowerCase(), d));
    }
    return rows.map(row => {
        const col = String(pickCell(row, 'department') || '').trim();
        if (scoped) {
            if (!col) return { departmentId, departmentName: null, error: null };
            const found = deptMap.get(col.toLowerCase());
            if (found && departmentId && found.id !== departmentId) {
                return { departmentId, departmentName: null, error: `Department mismatch: you can only import into your department` };
            }
            return { departmentId, departmentName: null, error: null };
        }
        if (!col) return { departmentId: null, departmentName: null, error: null };
        const found = deptMap.get(col.toLowerCase());
        if (!found) return { departmentId: null, departmentName: null, error: `Unknown department: ${col}` };
        return { departmentId: found.id, departmentName: found.name, error: null };
    });
};

// Resolve each row's instructor. Accepts an email or a name; blank → the
// importing admin. Scoped admins may only assign instructors in their dept.
const resolveCourseInstructors = async (req, rows, deptRows) => {
    const { scoped } = getDepartmentScope(req);
    const lookups = rows.map(row => {
        const raw = String(pickCell(row, 'instructor') || pickCell(row, 'instructor email') || '').trim();
        return { raw, lower: raw.toLowerCase() };
    });
    const emails = [...new Set(lookups.filter(l => l.raw && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(l.raw)).map(l => l.lower))];
    const names = [...new Set(lookups.filter(l => l.raw && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(l.raw)).map(l => l.raw))];

    const byEmail = new Map();
    const byName = new Map();
    if (emails.length) {
        const res = await query('SELECT id, name, email, role, department_id FROM users WHERE LOWER(email) = ANY($1::text[])', [emails]);
        res.rows.forEach(u => { byEmail.set(u.email.toLowerCase(), u); });
    }
    if (names.length) {
        const res = await query('SELECT id, name, email, role, department_id FROM users WHERE LOWER(name) = ANY($1::text[])', [names.map(n => n.toLowerCase())]);
        res.rows.forEach(u => { byName.set(u.name.toLowerCase(), u); });
    }

    return rows.map((row, i) => {
        const { raw, lower } = lookups[i];
        const targetDept = deptRows[i].departmentId;
        if (!raw) return { instructorId: req.user.id, instructorName: req.user.name, error: null };
        const user = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw) ? byEmail.get(lower) : byName.get(lower);
        if (!user) return { instructorId: null, instructorName: null, error: `Instructor not found: ${raw}` };
        if (!['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
            return { instructorId: null, instructorName: null, error: `${raw} is not an instructor` };
        }
        if (scoped && targetDept && user.department_id && user.department_id !== targetDept) {
            return { instructorId: null, instructorName: null, error: `Instructor ${raw} is outside your department` };
        }
        return { instructorId: user.id, instructorName: user.name, error: null };
    });
};

// Resolve category by name — creates it (with the department scope when given)
// on the real import, but only reports on preview.
const resolveCourseCategory = async (name, departmentId, create) => {
    const trimmed = String(name || '').trim();
    if (!trimmed) return { categoryId: null, categoryName: null, created: false };
    const existing = await query('SELECT id FROM categories WHERE LOWER(name) = LOWER($1) LIMIT 1', [trimmed]);
    if (existing.rows.length) return { categoryId: existing.rows[0].id, categoryName: trimmed, created: false };
    if (!create) return { categoryId: null, categoryName: trimmed, created: true, pendingCreate: true };
    const created = await query(
        `INSERT INTO categories (name, icon, department_id) VALUES ($1, '📚', $2) RETURNING id`,
        [trimmed, departmentId || null]
    );
    return { categoryId: created.rows[0].id, categoryName: trimmed, created: true };
};

// Shared runner for course import + preview (preview validates without writing).
const runCourseImport = async (req, res, { preview = false }) => {
    const rows = parseCourseSheet(req);
    const deptRows = await resolveCourseDepartments(req, rows);
    const instructorRows = await resolveCourseInstructors(req, rows, deptRows);

    const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];
    const results = [];
    let validCount = 0;

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const title = String(pickCell(row, 'title') || '').trim();
        const level = String(pickCell(row, 'level') || '').trim();
        const duration = String(pickCell(row, 'duration') || '').trim() || '0h';
        const description = String(pickCell(row, 'description') || '').trim();
        const categoryName = String(pickCell(row, 'category') || '').trim();

        let error = null;
        if (!title) error = 'Title is required';
        else if (instructorRows[i].error) error = instructorRows[i].error;
        else if (deptRows[i].error) error = deptRows[i].error;
        else if (level && !LEVELS.includes(level)) error = `Invalid level "${level}" (use Beginner, Intermediate, or Advanced)`;
        else if (title.length > 255) error = 'Title is too long (max 255 characters)';

        let categoryId = null;
        if (!error) {
            const cat = await resolveCourseCategory(categoryName, deptRows[i].departmentId, !preview);
            categoryId = cat.categoryId;
        }

        results.push({
            row: i + 1,
            title: title || '(no title)',
            instructorName: instructorRows[i].instructorName || null,
            departmentName: deptRows[i].departmentName || null,
            categoryName: categoryName || null,
            level: level || 'Beginner',
            duration,
            categoryId,
            status: error ? 'error' : (preview ? 'ok' : 'created'),
            error: error || null,
        });
        if (!error) validCount++;
    }

    if (preview) {
        const ok = results.filter(r => r.status === 'ok').length;
        return res.status(200).json({ total: results.length, ok, failed: results.length - ok, preview: true, results });
    }

    // ── Real import: batch-insert the valid rows ─────────────────────────────
    const valid = results.map((r, idx) => ({ ...r, idx })).filter(x => x.status === 'created');
    if (valid.length) {
        const titles = valid.map(r => r.title);
        const instructorIds = valid.map(r => instructorRows[r.idx].instructorId);
        const categoryIds = valid.map(r => r.categoryId);
        const levels = valid.map(r => r.level);
        const durations = valid.map(r => r.duration);
        const descriptions = valid.map(r => String(pickCell(rows[r.idx], 'description') || '').trim());

        const inserted = await query(`
            INSERT INTO courses (title, description, instructor_id, category_id, level, duration, status)
            SELECT t.title, t.description, t.instructor_id, t.category_id, t.level, t.duration, 'DRAFT'
            FROM unnest($1::text[], $2::text[], $3::uuid[], $4::uuid[], $5::text[], $6::text[], $7::text[])
                 AS t(title, description, instructor_id, category_id, level, duration, status)
            RETURNING id, title
        `, [titles, descriptions, instructorIds, categoryIds, levels, durations, titles.map(() => 'DRAFT')]);

        const insertedIds = inserted.rows.map(r => r.id);
        await query(
            `INSERT INTO audit_logs (user_id, action, resource, resource_id)
             SELECT $1, 'COURSE_IMPORTED', 'courses', t.id FROM unnest($2::uuid[]) AS t(id)`,
            [req.user.id, insertedIds]
        ).catch(() => { });
    }

    const created = results.filter(r => r.status === 'created').length;
    res.status(201).json({ total: results.length, created, failed: results.length - created, preview: false, results });
};

const importCourses = async (req, res) => runCourseImport(req, res, { preview: false });
const previewCourseImport = async (req, res) => runCourseImport(req, res, { preview: true });

// GET /api/courses/import/template — downloadable Excel template.
const downloadCourseTemplate = async (req, res) => {
    const xlsx = require('xlsx');
    const wb = xlsx.utils.book_new();
    const data = [{
        title: 'Java Programming',
        instructor: 'instructor@example.com',
        department: 'CSE',
        category: 'Programming',
        level: 'Beginner',
        duration: '8 weeks',
        description: 'Learn core Java from scratch',
    }];
    const ws = xlsx.utils.json_to_sheet(data);
    ws['!cols'] = [{ wch: 25 }, { wch: 30 }, { wch: 16 }, { wch: 20 }, { wch: 14 }, { wch: 12 }, { wch: 45 }];
    xlsx.utils.book_append_sheet(wb, ws, 'Courses');
    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename="Course_Import_Template.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
};

// POST /api/courses/:id/buckets — add a course to a semester and/or year bucket
// (many-to-many: the same course can be copied into several buckets).
// Body: { semesters?: number[], years?: number[] } — adds the given values.
const addBuckets = async (req, res) => {
    const { id } = req.params;
    await assertCourseOwnership(req, id);
    if (req.user.role === 'ADMIN') await assertCourseInScope(req, id);

    const semesters = Array.isArray(req.body.semesters) ? req.body.semesters : (req.body.semester != null ? [req.body.semester] : []);
    const years = Array.isArray(req.body.years) ? req.body.years : (req.body.year != null ? [req.body.year] : []);
    const toNum = (v) => { const n = Number(v); return Number.isInteger(n) && n > 0 ? n : null; };
    const semVals = semesters.map(toNum).filter(Boolean);
    const yrVals = years.map(toNum).filter(Boolean);
    if (!semVals.length && !yrVals.length) throw createError('Provide at least one semester or year', 400);

    if (semVals.length) {
        await query(
            `INSERT INTO course_semesters (course_id, semester)
             SELECT $1, t.sem FROM unnest($2::int[]) AS t(sem)
             ON CONFLICT (course_id, semester) DO NOTHING`,
            [id, semVals]
        );
    }
    if (yrVals.length) {
        await query(
            `INSERT INTO course_years (course_id, year)
             SELECT $1, t.yr FROM unnest($2::int[]) AS t(yr)
             ON CONFLICT (course_id, year) DO NOTHING`,
            [id, yrVals]
        );
    }

    await writeAudit(req, {
        action: 'COURSE_BUCKETS_UPDATED',
        resource: 'courses',
        resourceId: id,
        newValue: { semesters: semVals, years: yrVals },
    });

    res.json({ success: true });
};

// DELETE /api/courses/:id/buckets — remove a course from semester/year buckets.
// Body: { semesters?: number[], years?: number[] } — removes the given values.
const removeBuckets = async (req, res) => {
    const { id } = req.params;
    await assertCourseOwnership(req, id);
    if (req.user.role === 'ADMIN') await assertCourseInScope(req, id);

    const semesters = Array.isArray(req.body.semesters) ? req.body.semesters : (req.body.semester != null ? [req.body.semester] : []);
    const years = Array.isArray(req.body.years) ? req.body.years : (req.body.year != null ? [req.body.year] : []);
    const toNum = (v) => { const n = Number(v); return Number.isInteger(n) && n > 0 ? n : null; };
    const semVals = semesters.map(toNum).filter(Boolean);
    const yrVals = years.map(toNum).filter(Boolean);
    if (!semVals.length && !yrVals.length) throw createError('Provide at least one semester or year', 400);

    if (semVals.length) {
        await query(
            `DELETE FROM course_semesters WHERE course_id = $1 AND semester = ANY($2::int[])`,
            [id, semVals]
        );
    }
    if (yrVals.length) {
        await query(
            `DELETE FROM course_years WHERE course_id = $1 AND year = ANY($2::int[])`,
            [id, yrVals]
        );
    }

    await writeAudit(req, {
        action: 'COURSE_BUCKETS_UPDATED',
        resource: 'courses',
        resourceId: id,
        oldValue: { semesters: semVals, years: yrVals },
    });

    res.json({ success: true });
};

module.exports = { getAll, getById, getLessons, getByInstructor, create, update, approve, reject, publish, unpublish, assignInstructor, deleteCourse, createSection, updateSection, deleteSection, reorderSections, reorderLessons, moveLesson, createLesson, updateLesson, deleteLesson, importCourses, previewCourseImport, downloadCourseTemplate, addBuckets, removeBuckets };
