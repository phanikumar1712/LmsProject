require('dotenv').config();
const { pool } = require('./pool');

const createTables = async () => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // ── ENUMS ──────────────────────────────────────────────────────────────
        await client.query(`
            DO $$ BEGIN
                CREATE TYPE user_role AS ENUM ('STUDENT', 'INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN');
            EXCEPTION WHEN duplicate_object THEN null; END $$;
        `);
        await client.query(`
            DO $$ BEGIN
                CREATE TYPE course_status AS ENUM ('DRAFT', 'PENDING', 'PUBLISHED', 'REJECTED', 'ARCHIVED');
            EXCEPTION WHEN duplicate_object THEN null; END $$;
        `);
        await client.query(`
            DO $$ BEGIN
                CREATE TYPE lesson_type AS ENUM ('video', 'document', 'quiz', 'text');
            EXCEPTION WHEN duplicate_object THEN null; END $$;
        `);
        await client.query(`
            DO $$ BEGIN
                CREATE TYPE subscription_plan AS ENUM ('FREE', 'BASIC', 'PRO', 'ENTERPRISE');
            EXCEPTION WHEN duplicate_object THEN null; END $$;
        `);

        // ── USERS ──────────────────────────────────────────────────────────────
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name        VARCHAR(255) NOT NULL,
                email       VARCHAR(255) UNIQUE NOT NULL,
                password    VARCHAR(255) NOT NULL,
                role        user_role NOT NULL DEFAULT 'STUDENT',
                phone       VARCHAR(30) DEFAULT '',
                avatar      TEXT DEFAULT '',
                bio         TEXT DEFAULT '',
                active      BOOLEAN NOT NULL DEFAULT true,
                subscription_plan subscription_plan NOT NULL DEFAULT 'FREE',
                subscription_expiry DATE,
                earnings    DECIMAL(10,2) DEFAULT 0,
                current_streak INTEGER DEFAULT 0,
                longest_streak INTEGER DEFAULT 0,
                last_activity_date DATE,
                reset_otp     VARCHAR(6),
                reset_otp_expiry TIMESTAMP,
                created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `);

        // ── CATEGORIES ─────────────────────────────────────────────────────────
        await client.query(`
            CREATE TABLE IF NOT EXISTS categories (
                id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name        VARCHAR(100) UNIQUE NOT NULL,
                icon        VARCHAR(10) DEFAULT '📚',
                course_count INT DEFAULT 0,
                created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `);

        // ── DEPARTMENTS ────────────────────────────────────────────────────────
        // A department groups one or more categories. ADMINs are scoped to a
        // single department; SUPER_ADMINs are global (department_id NULL).
        await client.query(`
            CREATE TABLE IF NOT EXISTS departments (
                id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name        VARCHAR(100) UNIQUE NOT NULL,
                icon        VARCHAR(10) DEFAULT '🏛️',
                created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `);

        // ── COURSES ────────────────────────────────────────────────────────────
        await client.query(`
            CREATE TABLE IF NOT EXISTS courses (
                id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                title           VARCHAR(255) NOT NULL,
                description     TEXT DEFAULT '',
                short_desc      TEXT DEFAULT '',
                instructor_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                category_id     UUID REFERENCES categories(id) ON DELETE SET NULL,
                thumbnail       TEXT DEFAULT '',
                price           DECIMAL(10,2) DEFAULT 0,
                discount_price  DECIMAL(10,2),
                level           VARCHAR(50) DEFAULT 'Beginner',
                language        VARCHAR(50) DEFAULT 'English',
                tags            TEXT[] DEFAULT '{}',
                what_you_learn  TEXT[] DEFAULT '{}',
                requirements    TEXT[] DEFAULT '{}',
                status          course_status NOT NULL DEFAULT 'DRAFT',
                rating          DECIMAL(3,2) DEFAULT 0,
                review_count    INT DEFAULT 0,
                enrollment_count INT DEFAULT 0,
                duration        VARCHAR(50) DEFAULT '0h',
                certificate     BOOLEAN DEFAULT true,
                required_plan   subscription_plan DEFAULT 'FREE',
                created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `);

        // ── SECTIONS ───────────────────────────────────────────────────────────
        await client.query(`
            CREATE TABLE IF NOT EXISTS sections (
                id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                course_id   UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
                title       VARCHAR(255) NOT NULL,
                "order"     INT NOT NULL DEFAULT 1,
                created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `);

        // ── LESSONS ────────────────────────────────────────────────────────────
        await client.query(`
            CREATE TABLE IF NOT EXISTS lessons (
                id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                section_id  UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
                course_id   UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
                title       VARCHAR(255) NOT NULL,
                type        lesson_type NOT NULL DEFAULT 'video',
                content_url TEXT DEFAULT '',
                duration    VARCHAR(50) DEFAULT '',
                preview     BOOLEAN DEFAULT false,
                "order"     INT NOT NULL DEFAULT 1,
                created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `);

        // ── QUIZZES ────────────────────────────────────────────────────────────
        await client.query(`
            CREATE TABLE IF NOT EXISTS quizzes (
                id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                course_id       UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
                lesson_id       UUID REFERENCES lessons(id) ON DELETE SET NULL,
                title           VARCHAR(255) NOT NULL,
                description     TEXT DEFAULT '',
                passing_score   INT DEFAULT 70,
                time_limit      INT DEFAULT 30,
                questions       JSONB NOT NULL DEFAULT '[]',
                created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                CONSTRAINT quizzes_lesson_id_key UNIQUE (lesson_id)
            );
        `);

        // ── ENROLLMENTS ────────────────────────────────────────────────────────
        await client.query(`
            CREATE TABLE IF NOT EXISTS enrollments (
                id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                student_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                course_id           UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
                progress            INT DEFAULT 0,
                completed_lessons   UUID[] DEFAULT '{}',
                enrolled_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                last_accessed       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                completed_at        TIMESTAMPTZ,
                UNIQUE(student_id, course_id)
            );
        `);

        // ── QUIZ ATTEMPTS ──────────────────────────────────────────────────────
        await client.query(`
            CREATE TABLE IF NOT EXISTS quiz_attempts (
                id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                quiz_id     UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
                student_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                score       INT NOT NULL,
                passed      BOOLEAN NOT NULL,
                violations  INT DEFAULT 0,
                time_taken  INT DEFAULT 0,
                results     JSONB DEFAULT '[]',
                completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS quiz_attempt_sessions (
                id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                quiz_id      UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
                student_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                expires_at   TIMESTAMPTZ NOT NULL,
                submitted_at TIMESTAMPTZ
            );
        `);

        // ── RATINGS ────────────────────────────────────────────────────────────
        await client.query(`
            CREATE TABLE IF NOT EXISTS ratings (
                id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                course_id           UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
                student_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                stars               INT NOT NULL CHECK (stars >= 1 AND stars <= 5),
                comment             TEXT DEFAULT '',
                instructor_reply    TEXT,
                likes               INT DEFAULT 0,
                helpful             BOOLEAN DEFAULT false,
                created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE(course_id, student_id)
            );
        `);

        // ── RATING LIKES ───────────────────────────────────────────────────────
        await client.query(`
            CREATE TABLE IF NOT EXISTS rating_likes (
                rating_id   UUID NOT NULL REFERENCES ratings(id) ON DELETE CASCADE,
                user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                PRIMARY KEY (rating_id, user_id)
            );
        `);

        // ── WISHLIST ───────────────────────────────────────────────────────────
        await client.query(`
            CREATE TABLE IF NOT EXISTS wishlist (
                user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                course_id   UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
                added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                PRIMARY KEY (user_id, course_id)
            );
        `);

        // ── NOTIFICATIONS ─────────────────────────────────────────────────────
        await client.query(`
            CREATE TABLE IF NOT EXISTS notifications (
                id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                message     TEXT NOT NULL,
                type        VARCHAR(50) DEFAULT 'info',
                link        TEXT DEFAULT '',
                read        BOOLEAN DEFAULT false,
                created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `);

        // ── SUBSCRIPTION PLANS ────────────────────────────────────────────────
        await client.query(`
            CREATE TABLE IF NOT EXISTS subscription_plans (
                id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name        VARCHAR(100) UNIQUE NOT NULL,
                price       DECIMAL(10,2) NOT NULL,
                duration    INT NOT NULL DEFAULT 30,
                features    TEXT[] DEFAULT '{}',
                popular     BOOLEAN DEFAULT false,
                created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS subscription_plan_courses (
                plan_id     UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE,
                course_id   UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
                priority    INT NOT NULL DEFAULT 1,
                created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                PRIMARY KEY (plan_id, course_id),
                UNIQUE (plan_id, priority)
            );
        `);

        // ── INSTRUCTOR REQUESTS ───────────────────────────────────────────────
        await client.query(`
            CREATE TABLE IF NOT EXISTS instructor_requests (
                id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                bio           TEXT,
                expertise     VARCHAR(255),
                experience    VARCHAR(50),
                sample_topic  VARCHAR(255),
                linkedin      VARCHAR(255),
                youtube       VARCHAR(255),
                status        VARCHAR(50) DEFAULT 'PENDING',
                created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `);

        // ── PLATFORM SETTINGS ─────────────────────────────────────────────────
        await client.query(`
            CREATE TABLE IF NOT EXISTS platform_settings (
                key TEXT PRIMARY KEY,
                value JSONB NOT NULL,
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);

        // ── AUDIT LOGS ────────────────────────────────────────────────────────
        await client.query(`
            CREATE TABLE IF NOT EXISTS audit_logs (
                id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
                action      VARCHAR(255) NOT NULL,
                resource    VARCHAR(100),
                resource_id UUID,
                details     JSONB DEFAULT '{}',
                ip_address  VARCHAR(50),
                created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `);

        // ── FOLLOWS ───────────────────────────────────────────────────────────
        await client.query(`
            CREATE TABLE IF NOT EXISTS follows (
                follower_id     UUID REFERENCES users(id) ON DELETE CASCADE,
                following_id    UUID REFERENCES users(id) ON DELETE CASCADE,
                created_at      TIMESTAMPTZ DEFAULT NOW(),
                PRIMARY KEY (follower_id, following_id)
            );
        `);

        // ── INDEXES ───────────────────────────────────────────────────────────
        await client.query(`CREATE INDEX IF NOT EXISTS idx_courses_instructor ON courses(instructor_id); `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_courses_category ON courses(category_id); `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_courses_status ON courses(status); `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments(student_id); `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_enrollments_course ON enrollments(course_id); `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_lessons_course ON lessons(course_id); `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_ratings_course ON ratings(course_id); `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id); `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id); `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_instructor_requests_user ON instructor_requests(user_id); `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_quiz_sessions_student_quiz ON quiz_attempt_sessions(student_id, quiz_id); `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_lessons_section ON lessons(section_id); `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_ratings_student ON ratings(student_id); `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_quiz_attempts_student ON quiz_attempts(student_id); `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz_student ON quiz_attempts(quiz_id, student_id); `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC); `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_user_action ON audit_logs(user_id, action, created_at DESC); `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_users_role ON users(role); `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_enrollments_enrolled_at ON enrollments(enrolled_at); `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_subscription_plan_courses_course ON subscription_plan_courses(course_id); `);

        // ── PERFORMANCE INDEXES (batch 2) ─────────────────────────────────────
        // Trigram indexes for ILIKE text search on courses and users.
        // pg_trgm requires superuser privileges on some hosts; gracefully skip
        // if unavailable — trigram indexes help but aren't critical.
        await client.query(`
            DO $$ BEGIN
                CREATE EXTENSION IF NOT EXISTS pg_trgm;
            EXCEPTION WHEN insufficient_privilege THEN
                -- pg_trgm unavailable on this host; ILIKE falls back to seq scan.
            END $$;
        `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_courses_title_trgm ON courses USING gin (title gin_trgm_ops); `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_users_name_trgm ON users USING gin (name gin_trgm_ops); `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_users_email_trgm ON users USING gin (email gin_trgm_ops); `);
        // Composite indexes for common filtered queries
        await client.query(`CREATE INDEX IF NOT EXISTS idx_courses_instructor_status ON courses(instructor_id, status); `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_courses_category_status ON courses(category_id, status); `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_courses_status_created ON courses(status, created_at DESC); `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_enrollments_student_progress ON enrollments(student_id, progress); `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action); `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_quiz_attempt_sessions_expires ON quiz_attempt_sessions(expires_at); `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_quiz_attempt_sessions_active ON quiz_attempt_sessions(quiz_id, student_id) WHERE submitted_at IS NULL; `);
        // Index for the correlated subquery in courseFields
        await client.query(`CREATE INDEX IF NOT EXISTS idx_lessons_course_count ON lessons(course_id) WHERE course_id IS NOT NULL; `);

        // ── PATCH EXISTING DATABASES ──────────────────────────────────────────
        await client.query(`
            ALTER TABLE subscription_plans
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
        `);
        await client.query(`
            CREATE TABLE IF NOT EXISTS subscription_plan_courses (
                plan_id     UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE,
                course_id   UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
                priority    INT NOT NULL DEFAULT 1,
                created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                PRIMARY KEY (plan_id, course_id)
            );
        `);
        await client.query(`
            ALTER TABLE subscription_plan_courses
            ADD COLUMN IF NOT EXISTS priority INT NOT NULL DEFAULT 1,
            ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
        `);
        await client.query(`
            ALTER TABLE users
            ALTER COLUMN subscription_plan DROP DEFAULT,
            ALTER COLUMN subscription_plan TYPE VARCHAR(100) USING subscription_plan::text,
            ALTER COLUMN subscription_plan SET DEFAULT 'FREE';
        `);
        await client.query(`
            ALTER TABLE enrollments
            ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
        `);
        await client.query(`
            ALTER TABLE notifications
            ADD COLUMN IF NOT EXISTS link TEXT DEFAULT '';
        `);
        await client.query(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_constraint
                    WHERE conrelid = 'quizzes'::regclass
                      AND contype = 'u'
                      AND conkey = ARRAY[
                          (SELECT attnum FROM pg_attribute
                           WHERE attrelid = 'quizzes'::regclass AND attname = 'lesson_id')
                      ]::smallint[]
                ) THEN
                    ALTER TABLE quizzes
                    ADD CONSTRAINT quizzes_lesson_id_key UNIQUE (lesson_id);
                END IF;
            END $$;
        `);
        await client.query(`
            UPDATE enrollments SET completed_at = last_accessed
            WHERE progress >= 100 AND completed_at IS NULL;
        `);

        // Question-bank support: selection_config controls how questions are
        // drawn per attempt ({mode, easy, medium, hard, count}); each attempt
        // session pins the exact question ids it was served so grading matches.
        await client.query(`
            ALTER TABLE quizzes
            ADD COLUMN IF NOT EXISTS selection_config JSONB DEFAULT NULL;
        `);
        await client.query(`
            ALTER TABLE quiz_attempt_sessions
            ADD COLUMN IF NOT EXISTS question_ids TEXT[] DEFAULT NULL;
        `);

        // -- ENSURE USERS TABLE HAS ALL RECENT FIELDS --
        await client.query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS current_streak INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS longest_streak INTEGER DEFAULT 0,
                ADD COLUMN IF NOT EXISTS last_activity_date DATE,
                    ADD COLUMN IF NOT EXISTS reset_otp VARCHAR(6),
                        ADD COLUMN IF NOT EXISTS reset_otp_expiry TIMESTAMP,
                        ADD COLUMN IF NOT EXISTS phone VARCHAR(30) DEFAULT '';
        `);

        // -- DEPARTMENT ISOLATION: scope admins/categories to a department --
        await client.query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id) ON DELETE SET NULL;
        `);
        await client.query(`
            ALTER TABLE categories
            ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id) ON DELETE SET NULL;
        `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_users_department ON users(department_id); `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_categories_department ON categories(department_id); `);

        // -- ADMIN QUOTAS: per-admin override on how many students/courses their
        // department may hold. NULL => inherit the global default from platform_settings.
        await client.query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS max_students INT,
            ADD COLUMN IF NOT EXISTS max_courses  INT;
        `);

        // -- ADMIN-DEPARTMENTS JUNCTION TABLE: many-to-many so an ADMIN can be
        // assigned to multiple departments. The primary department for scoping
        // remains users.department_id; extra assignments live here.
        await client.query(`
            CREATE TABLE IF NOT EXISTS admin_departments (
                user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
                created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                PRIMARY KEY (user_id, department_id)
            );
        `);
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_admin_departments_user ON admin_departments(user_id);
        `);
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_admin_departments_dept ON admin_departments(department_id);
        `);

        // ── NEW FEATURE TABLES: Announcements, Sessions, Assignments ────────────
        await client.query(`
            CREATE TABLE IF NOT EXISTS announcements (
                id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                department_id   UUID REFERENCES departments(id) ON DELETE CASCADE,
                author_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                title           VARCHAR(255) NOT NULL,
                content         TEXT NOT NULL,
                priority        VARCHAR(20) DEFAULT 'normal',
                pinned          BOOLEAN DEFAULT false,
                target_roles    TEXT[] DEFAULT '{"STUDENT","INSTRUCTOR"}',
                created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_announcements_dept ON announcements(department_id); `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_announcements_pinned ON announcements(pinned, created_at DESC); `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS academic_sessions (
                id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name            VARCHAR(255) NOT NULL,
                department_id   UUID REFERENCES departments(id) ON DELETE CASCADE,
                start_date      DATE NOT NULL,
                end_date        DATE NOT NULL,
                enrollment_open BOOLEAN DEFAULT true,
                created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_sessions_dept_date ON academic_sessions(department_id, start_date DESC); `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS assignments (
                id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                course_id       UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
                lesson_id       UUID REFERENCES lessons(id) ON DELETE SET NULL,
                title           VARCHAR(255) NOT NULL,
                description     TEXT DEFAULT '',
                max_marks       INT NOT NULL DEFAULT 100,
                due_date        TIMESTAMPTZ NOT NULL,
                allow_late      BOOLEAN DEFAULT false,
                file_required   BOOLEAN DEFAULT true,
                rubric_enabled  BOOLEAN DEFAULT false,
                created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `);        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_assignments_course ON assignments(course_id); `);

        // ── RUBRIC GRADING ────────────────────────────────────────────────────
        await client.query(`
            CREATE TABLE IF NOT EXISTS rubric_criteria (
                id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                assignment_id   UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
                criterion_name  VARCHAR(255) NOT NULL,
                max_score       INT NOT NULL DEFAULT 10,
                description     TEXT DEFAULT '',
                "order"         INT NOT NULL DEFAULT 1,
                created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `);
        await client.query(`
            CREATE TABLE IF NOT EXISTS rubric_scores (
                id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                submission_id   UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
                criterion_id    UUID NOT NULL REFERENCES rubric_criteria(id) ON DELETE CASCADE,
                score           INT NOT NULL DEFAULT 0,
                comment         TEXT DEFAULT '',
                created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE(submission_id, criterion_id)
            );
        `);

        // ── DISCUSSION FORUMS ─────────────────────────────────────────────────
        await client.query(`
            CREATE TABLE IF NOT EXISTS discussion_questions (
                id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                course_id       UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
                lesson_id       UUID REFERENCES lessons(id) ON DELETE SET NULL,
                student_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                title           VARCHAR(255) NOT NULL,
                content         TEXT NOT NULL,
                answer_count    INT DEFAULT 0,
                created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `);
        await client.query(`
            CREATE TABLE IF NOT EXISTS discussion_answers (
                id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                question_id     UUID NOT NULL REFERENCES discussion_questions(id) ON DELETE CASCADE,
                user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                content         TEXT NOT NULL,
                upvotes         INT DEFAULT 0,
                is_best_answer  BOOLEAN DEFAULT false,
                created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `);
        await client.query(`
            CREATE TABLE IF NOT EXISTS answer_upvotes (
                user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                answer_id   UUID NOT NULL REFERENCES discussion_answers(id) ON DELETE CASCADE,
                created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                PRIMARY KEY (user_id, answer_id)
            );
        `);

        // ── INDEXES FOR NEW FEATURES ──────────────────────────────────────────
        await client.query(`CREATE INDEX IF NOT EXISTS idx_discussion_questions_course ON discussion_questions(course_id); `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_discussion_questions_lesson ON discussion_questions(lesson_id); `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_discussion_answers_question ON discussion_answers(question_id); `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_rubric_criteria_assignment ON rubric_criteria(assignment_id); `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_rubric_scores_submission ON rubric_scores(submission_id); `);

        // ── CERTIFICATES ──────────────────────────────────────────────────────
        await client.query(`
            CREATE TABLE IF NOT EXISTS certificates (
                id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                student_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                course_id       UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
                cert_id         VARCHAR(50) UNIQUE NOT NULL,
                student_name    VARCHAR(255) NOT NULL,
                course_title    VARCHAR(255) NOT NULL,
                instructor_name VARCHAR(255) NOT NULL,
                issue_date      DATE NOT NULL DEFAULT CURRENT_DATE,
                created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE(student_id, course_id)
            );
        `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_certificates_student ON certificates(student_id); `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_certificates_cert_id ON certificates(cert_id); `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS submissions (
                id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                assignment_id   UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
                student_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                file_url        TEXT DEFAULT '',
                comments        TEXT DEFAULT '',
                marks           INT,
                feedback        TEXT,
                graded_by       UUID REFERENCES users(id) ON DELETE SET NULL,
                submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                graded_at       TIMESTAMPTZ,
                UNIQUE(assignment_id, student_id)
            );
        `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_submissions_assignment ON submissions(assignment_id); `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_submissions_student ON submissions(student_id); `);

        // -- COURSE SCHEDULING: start/end dates and multi-step review level --
        await client.query(`
            ALTER TABLE courses
            ADD COLUMN IF NOT EXISTS start_date DATE,
            ADD COLUMN IF NOT EXISTS end_date DATE;
        `);
        await client.query(`
            ALTER TABLE courses
            ADD COLUMN IF NOT EXISTS review_level VARCHAR(50) DEFAULT 'single';
        `);
        await client.query(`
            ALTER TABLE courses
            ADD COLUMN IF NOT EXISTS review_note TEXT DEFAULT '';
        `);

        // ── COURSE VERSIONS & SNAPSHOTS ────────────────────────────────────────
        // When an instructor publishes a new version of a course, a full snapshot
        // of all sections, lessons, and quizzes is stored as JSONB. Students see
        // the version they were enrolled under.
        await client.query(`
            CREATE TABLE IF NOT EXISTS course_versions (
                id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                course_id       UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
                version_number  INT NOT NULL DEFAULT 1,
                version_label   VARCHAR(100) DEFAULT '',
                changelog       TEXT DEFAULT '',
                snapshot        JSONB NOT NULL DEFAULT '{}',
                created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE(course_id, version_number)
            );
        `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_course_versions_course ON course_versions(course_id); `);

        // ── DRIP CONTENT / SCHEDULED RELEASE ──────────────────────────────────
        await client.query(`
            ALTER TABLE courses
            ADD COLUMN IF NOT EXISTS drip_mode VARCHAR(20) DEFAULT 'none';
        `);
        await client.query(`
            ALTER TABLE courses
            ADD CONSTRAINT IF NOT EXISTS courses_drip_mode_check
            CHECK (drip_mode IN ('none', 'absolute', 'relative', 'both'));
        `);
        await client.query(`
            ALTER TABLE lessons
            ADD COLUMN IF NOT EXISTS release_date TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS drip_delay_days INT;
        `);
        await client.query(`
            ALTER TABLE enrollments
            ADD COLUMN IF NOT EXISTS version_id UUID REFERENCES course_versions(id) ON DELETE SET NULL;
        `);

        // ── DEPARTMENT LIMITS: student/course quotas per department ────────────
        await client.query(`
            ALTER TABLE departments
            ADD COLUMN IF NOT EXISTS max_students INT,
            ADD COLUMN IF NOT EXISTS max_courses  INT;
        `);

        // ── LIVE SESSIONS & ATTENDANCE ────────────────────────────────────────
        await client.query(`
            DO $$ BEGIN
                CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'late', 'excused');
            EXCEPTION WHEN duplicate_object THEN null; END $$;
        `);
        await client.query(`
            CREATE TABLE IF NOT EXISTS live_sessions (
                id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                course_id       UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
                instructor_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                title           VARCHAR(255) NOT NULL,
                session_date    DATE NOT NULL,
                start_time      TIME,
                end_time        TIME,
                meeting_link    TEXT DEFAULT '',
                academic_session_id UUID REFERENCES academic_sessions(id) ON DELETE SET NULL,
                created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_live_sessions_course ON live_sessions(course_id); `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_live_sessions_instructor ON live_sessions(instructor_id); `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_live_sessions_date ON live_sessions(session_date); `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS attendance (
                id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                session_id      UUID NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
                student_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                status          attendance_status NOT NULL DEFAULT 'absent',
                marked_by       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                marked_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE(session_id, student_id)
            );
        `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_attendance_session ON attendance(session_id); `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id); `);

        // -- ROLL NO: unique student identifier per department --
        await client.query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS roll_no VARCHAR(50);
        `);
        // Partial unique index: only STUDENT rows with a non-NULL roll_no are
        // checked. Composite on (roll_no, department_id) so different departments
        // can reuse the same roll_no (e.g. CSE has CS22001, IT has IT22001).
        // COALESCE handles students without a department (NULL -> fake UUID) so
        // two departmentless students can't share a roll_no either.
        await client.query(`
            DO $$ BEGIN
                DROP INDEX IF EXISTS idx_users_roll_no_old;
            EXCEPTION WHEN undefined_table THEN null; END $$;
        `);
        await client.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_users_roll_no_dept
            ON users(roll_no, COALESCE(department_id, '00000000-0000-0000-0000-000000000000'))
            WHERE role = 'STUDENT' AND roll_no IS NOT NULL;
        `);

        // ── SEED DEFAULT CATEGORIES ───────────────────────────────────────────
        await client.query(`
            INSERT INTO categories(name, icon) VALUES
            ('Development', '💻'), ('Design', '🎨'), ('Marketing', '📊'),
            ('Business', '💼'), ('Data Science', '📈'), ('Photography', '📷'),
            ('Music', '🎵'), ('Health', '🏃'), ('Personal Development', '🚀'), ('Finance', '💰')
            ON CONFLICT(name) DO NOTHING;
        `);

        // ── SEED ACADEMIC DEPARTMENTS + SUBJECT CATEGORIES ────────────────────
        // Each department owns a set of subject categories. An ADMIN assigned a
        // department (e.g. CSE) only manages courses/lessons in that department's
        // subjects — nothing from ECE, Mechanical, etc.
        const academicDepartments = {
            CSE: { icon: '💻', categories: ['Programming', 'Data Structures', 'Algorithms', 'Databases', 'Artificial Intelligence'] },
            ECE: { icon: '📡', categories: ['Digital Electronics', 'Signals & Systems', 'VLSI Design', 'Communication Systems'] },
            EEE: { icon: '⚡', categories: ['Electric Circuits', 'Power Systems', 'Electrical Machines'] },
            Mechanical: { icon: '⚙️', categories: ['Thermodynamics', 'Fluid Mechanics', 'Manufacturing', 'Machine Design'] },
            Civil: { icon: '🏗️', categories: ['Structural Engineering', 'Geotechnical Engineering', 'Surveying', 'Transportation'] },
        };
        for (const [dept, { icon }] of Object.entries(academicDepartments)) {
            await client.query(
                `INSERT INTO departments(name, icon) VALUES ($1, $2) ON CONFLICT(name) DO NOTHING;`,
                [dept, icon]
            );
        }
        // Seed each subject category and (re)map it to its department. ON CONFLICT
        // keeps the mapping correct on re-runs even if the category already exists.
        for (const [dept, { icon, categories }] of Object.entries(academicDepartments)) {
            for (const cat of categories) {
                await client.query(
                    `INSERT INTO categories(name, icon, department_id)
                     VALUES ($1, $2, (SELECT id FROM departments WHERE name = $3))
                     ON CONFLICT(name) DO UPDATE
                       SET department_id = (SELECT id FROM departments WHERE name = $3);`,
                    [cat, icon, dept]
                );
            }
        }
        // Assign the demo admin to CSE so department isolation is testable out of the box.
        await client.query(`
            UPDATE users SET department_id = (SELECT id FROM departments WHERE name = 'CSE')
            WHERE email = 'admin@demo.com' AND department_id IS NULL;
        `);

        // ── SEED SUBSCRIPTION PLANS ───────────────────────────────────────────
        await client.query(`
            INSERT INTO subscription_plans(name, price, duration, features, popular) VALUES
            ('FREE', 0, 0, ARRAY['Access to free courses', 'Community support', 'Certificate on completion'], false),
            ('BASIC', 9.99, 30, ARRAY['50+ Premium courses', 'HD Video quality', 'Certificate on completion', '1 course download'], false),
            ('PRO', 19.99, 30, ARRAY['All BASIC features', 'Unlimited premium courses', 'Offline downloads', 'Priority support', 'Advanced analytics'], true),
            ('ENTERPRISE', 49.99, 30, ARRAY['All PRO features', 'Team management', 'Custom LMS branding', 'API access', 'Dedicated account manager'], false)
            ON CONFLICT(name) DO NOTHING;
        `);

        // ── SEED DEFAULT SETTINGS ─────────────────────────────────────────────
        const defaultSettings = {
            siteName: 'EduNexus LMS',
            siteTagline: 'Learn Without Limits',
            supportEmail: 'support@edunexus.com',
            defaultCurrency: 'INR',
            instructorRevenueShare: 70,
            maxUploadSizeMB: 500,
            requireApproval: true,
            maintenanceMode: false,
            smtpHost: 'smtp.sendgrid.net',
            smtpPort: '587',
            emailFrom: 'noreply@edunexus.com',
            razorpayEnabled: true,
            stripeEnabled: false,
            jwtExpiryDays: 1,
            maxLoginAttempts: 5,
            twoFactorRequired: false,
            newEnrollmentNotif: true,
            newReviewNotif: true,
            weeklyReportEmail: true,
            defaultMaxStudentsPerAdmin: 500,
            defaultMaxCoursesPerAdmin: 100,
        };
        await client.query(`
            INSERT INTO platform_settings(key, value)
        VALUES('global', $1)
            ON CONFLICT(key) DO NOTHING;
        `, [JSON.stringify(defaultSettings)]);

        // Idempotent backfill: ensure the two admin-quota defaults exist on the
        // already-seeded 'global' row without clobbering other settings. jsonb `||`
        // puts existing keys last so we never overwrite an admin-tuned value.
        await client.query(`
            UPDATE platform_settings
            SET value = '{"defaultMaxStudentsPerAdmin":500,"defaultMaxCoursesPerAdmin":100}'::jsonb || value
            WHERE key = 'global';
        `);

        // ── SEED SUPER ADMIN ──────────────────────────────────────────────────
        const bcrypt = require('bcryptjs');
        const superAdminPass = await bcrypt.hash('superadmin', 12);
        await client.query(`
            INSERT INTO users(name, email, password, role, avatar)
        VALUES('Super Admin', 'superadmin@lms.com', $1, 'SUPER_ADMIN', '')
            ON CONFLICT(email) DO NOTHING;
        `, [superAdminPass]);

        // ── CLEANUP: Remove dummy / departmentless users ──────────────────────
        // Delete any existing STUDENT or INSTRUCTOR that has no department_id.
        // These are legacy seeded rows (student@demo.com, instructor@demo.com)
        // or any manually created orphans that should belong to a department.
        await client.query(`
            DELETE FROM users
            WHERE role IN ('STUDENT', 'INSTRUCTOR')
              AND department_id IS NULL
              AND email != 'superadmin@lms.com';
        `);
        // Remove the old single CSE admin mapping — we seed per-dept admins below.
        await client.query(`
            UPDATE users SET department_id = NULL
            WHERE email = 'admin@demo.com' AND department_id IS NOT NULL;
        `);
        await client.query(`
            DELETE FROM users WHERE email = 'admin@demo.com' AND role = 'ADMIN';
        `);

        // ── SEED USERS PER DEPARTMENT ─────────────────────────────────────────
        // Each academic department gets its own admin, instructor, and students.
        // All share the same demo password for easy testing.
        const demoPass = await bcrypt.hash('demo123', 12);

        const deptUsers = {
            CSE: {
                admin:   { name: 'CSE Admin',       email: 'cse.admin@demo.com' },
                instructor: { name: 'Dr. Arjun Patel', email: 'cse.instructor@demo.com' },
                students: [
                    { name: 'Riya Sharma', email: 'cse.student1@demo.com', rollNo: 'CS22001' },
                    { name: 'Amit Verma',  email: 'cse.student2@demo.com', rollNo: 'CS22002' },
                ],
            },
            ECE: {
                admin:   { name: 'ECE Admin',       email: 'ece.admin@demo.com' },
                instructor: { name: 'Prof. Meera Nair', email: 'ece.instructor@demo.com' },
                students: [
                    { name: 'Karthik Reddy', email: 'ece.student1@demo.com', rollNo: 'EC22001' },
                    { name: 'Sneha Gupta',   email: 'ece.student2@demo.com', rollNo: 'EC22002' },
                ],
            },
            EEE: {
                admin:   { name: 'EEE Admin',           email: 'eee.admin@demo.com' },
                instructor: { name: 'Dr. Vikram Singh', email: 'eee.instructor@demo.com' },
                students: [
                    { name: 'Priya Deshmukh', email: 'eee.student1@demo.com', rollNo: 'EE22001' },
                ],
            },
            Mechanical: {
                admin:   { name: 'Mech Admin',                email: 'mech.admin@demo.com' },
                instructor: { name: 'Prof. Anand Joshi',      email: 'mech.instructor@demo.com' },
                students: [
                    { name: 'Rohit Kadam', email: 'mech.student1@demo.com', rollNo: 'ME22001' },
                ],
            },
            Civil: {
                admin:   { name: 'Civil Admin',          email: 'civil.admin@demo.com' },
                instructor: { name: 'Dr. Sunita Rao',    email: 'civil.instructor@demo.com' },
                students: [
                    { name: 'Anjali Mehta', email: 'civil.student1@demo.com', rollNo: 'CE22001' },
                ],
            },
        };

        for (const [deptName, users] of Object.entries(deptUsers)) {
            // Fetch the department ID (seeded already above)
            const deptRes = await client.query('SELECT id FROM departments WHERE name = $1', [deptName]);
            if (!deptRes.rows.length) {
                console.warn(`⚠️  Department "${deptName}" not found — skipping its users.`);
                continue;
            }
            const deptId = deptRes.rows[0].id;

            // Admin (one per department)
            await client.query(
                `INSERT INTO users(name, email, password, role, department_id, avatar)
                 VALUES($1, $2, $3, 'ADMIN', $4, '')
                 ON CONFLICT(email) DO NOTHING;`,
                [users.admin.name, users.admin.email, demoPass, deptId]
            );

            // Instructor (one per department)
            await client.query(
                `INSERT INTO users(name, email, password, role, department_id, avatar)
                 VALUES($1, $2, $3, 'INSTRUCTOR', $4, '')
                 ON CONFLICT(email) DO NOTHING;`,
                [users.instructor.name, users.instructor.email, demoPass, deptId]
            );

            // Students
            for (const student of users.students) {
                await client.query(
                    `INSERT INTO users(name, email, password, role, department_id, roll_no, avatar)
                     VALUES($1, $2, $3, 'STUDENT', $4, $5, '')
                     ON CONFLICT(email) DO NOTHING;`,
                    [student.name, student.email, demoPass, deptId, student.rollNo || null]
                );
            }
        }

        // ── CLEANUP: blank out any legacy DiceBear cartoon avatars ────────────
        await client.query(`UPDATE users SET avatar = '' WHERE avatar LIKE '%api.dicebear.com%';`);

        await client.query('COMMIT');
        console.log('✅ Database migrated successfully!');
        console.log('');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📋  DEMO ACCOUNTS — Password: demo123');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('');
        console.log('👑 SUPER ADMIN');
        console.log('   superadmin@lms.com / superadmin');
        console.log('');
        console.log('🏛️  DEPARTMENT ADMINS (1 per dept)');
        for (const deptName of Object.keys(deptUsers)) {
            console.log(`   ${deptName}: ${deptUsers[deptName].admin.email} / demo123`);
        }
        console.log('');
        console.log('👨‍🏫  INSTRUCTORS (1 per dept)');
        for (const deptName of Object.keys(deptUsers)) {
            const inst = deptUsers[deptName].instructor;
            console.log(`   ${deptName}: ${inst.email} / demo123  (${inst.name})`);
        }
        console.log('');
        console.log('🎓  STUDENTS');
        for (const deptName of Object.keys(deptUsers)) {
            for (const s of deptUsers[deptName].students) {
                console.log(`   ${deptName}: ${s.email} / demo123  roll:${s.rollNo}`);
            }
        }
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', err.message);
        throw err;
    } finally {
        client.release();
        await pool.end();
    }
};

createTables().catch(() => process.exit(1));
