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

        // ── PATCH EXISTING DATABASES ──────────────────────────────────────────
        await client.query(`
            ALTER TABLE subscription_plans
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
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

        // -- ENSURE USERS TABLE HAS ALL RECENT FIELDS --
        await client.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS current_streak INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS longest_streak INTEGER DEFAULT 0,
                ADD COLUMN IF NOT EXISTS last_activity_date DATE,
                    ADD COLUMN IF NOT EXISTS reset_otp VARCHAR(6),
                        ADD COLUMN IF NOT EXISTS reset_otp_expiry TIMESTAMP;
        `);

        // ── SEED DEFAULT CATEGORIES ───────────────────────────────────────────
        await client.query(`
            INSERT INTO categories(name, icon) VALUES
            ('Development', '💻'), ('Design', '🎨'), ('Marketing', '📊'),
            ('Business', '💼'), ('Data Science', '📈'), ('Photography', '📷'),
            ('Music', '🎵'), ('Health', '🏃'), ('Personal Development', '🚀'), ('Finance', '💰')
            ON CONFLICT(name) DO NOTHING;
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
        };
        await client.query(`
            INSERT INTO platform_settings(key, value)
        VALUES('global', $1)
            ON CONFLICT(key) DO NOTHING;
        `, [JSON.stringify(defaultSettings)]);

        // ── SEED SUPER ADMIN ──────────────────────────────────────────────────
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash('admin123', 12);
        await client.query(`
            INSERT INTO users(name, email, password, role, avatar)
        VALUES('Super Admin', 'superadmin@lms.com', $1, 'SUPER_ADMIN', 'https://api.dicebear.com/7.x/avataaars/svg?seed=SuperAdmin')
            ON CONFLICT(email) DO NOTHING;
        `, [hashedPassword]);

        // ── SEED DEMO USERS ───────────────────────────────────────────────────
        const demoUsers = [
            { name: 'Alex Johnson', email: 'student@demo.com', role: 'STUDENT' },
            { name: 'Sarah Chen', email: 'instructor@demo.com', role: 'INSTRUCTOR' },
            { name: 'Mike Wilson', email: 'admin@demo.com', role: 'ADMIN' },
        ];
        const demoPass = await bcrypt.hash('demo123', 12);
        for (const u of demoUsers) {
            await client.query(`
                INSERT INTO users(name, email, password, role, avatar)
        VALUES($1, $2, $3, $4, $5)
                ON CONFLICT(email) DO NOTHING;
        `, [u.name, u.email, demoPass, u.role, `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.name}`]);
        }

        await client.query('COMMIT');
        console.log('✅ Database migrated successfully!');
        console.log('\n📋 Demo Accounts:');
        console.log('   Super Admin : superadmin@lms.com / admin123');
        console.log('   Admin       : admin@demo.com / demo123');
        console.log('   Instructor  : instructor@demo.com / demo123');
        console.log('   Student     : student@demo.com / demo123');
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
