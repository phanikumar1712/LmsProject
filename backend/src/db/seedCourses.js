require('dotenv').config();
const { pool } = require('./pool');

const seedCourses = async () => {
    try {
        const client = await pool.connect();

        // 1. Get an instructor
        const insRes = await client.query("SELECT id FROM users WHERE role = 'INSTRUCTOR' LIMIT 1");
        if (insRes.rows.length === 0) {
            console.error("No instructor found! Run migrate.js first to seed users.");
            process.exit(1);
        }
        const instructorId = insRes.rows[0].id;

        // 2. Get some categories
        const catRes = await client.query("SELECT id, name FROM categories LIMIT 5");
        if (catRes.rows.length === 0) {
            console.error("No categories found!");
            process.exit(1);
        }

        const categories = catRes.rows;

        const coursesData = [
            {
                title: "Complete Web Development Bootcamp 2026",
                description: "Learn HTML, CSS, JavaScript, React, Node.js, and PostgreSQL from scratch.",
                short_desc: "Become a Full-Stack Web Developer with just one course.",
                level: "Beginner",
                language: "English",
                status: "PUBLISHED"
            },
            {
                title: "Advanced React & Next.js Patterns",
                description: "Master React server components, Next.js 15, and advanced frontend architectures.",
                short_desc: "Take your React skills to the next level.",
                level: "Advanced",
                language: "English",
                status: "PUBLISHED"
            },
            {
                title: "Python for Data Science",
                description: "Learn Pandas, NumPy, Matplotlib, and Scikit-Learn. Start analyzing data like a pro.",
                short_desc: "Data Science crash course using Python.",
                level: "Intermediate",
                language: "English",
                status: "PUBLISHED"
            },
            {
                title: "UI/UX Design Masterclass",
                description: "Learn Figma, design theories, user research, and wireframing.",
                short_desc: "Design stunning interfaces starting today.",
                level: "Beginner",
                language: "English",
                status: "PUBLISHED"
            }
        ];

        console.log("Seeding courses...");

        for (let i = 0; i < coursesData.length; i++) {
            const course = coursesData[i];
            const category = categories[i % categories.length];
            const thumbnail = `https://picsum.photos/seed/course_${i + 1}/600/400`;

            const res = await client.query(`
                INSERT INTO courses (
                    title, description, short_desc, instructor_id, category_id, 
                    thumbnail, level, language, status, rating
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING id
            `, [
                course.title, course.description, course.short_desc, instructorId, category.id,
                thumbnail, course.level, course.language, course.status, 4.5 + (Math.random() * 0.5)
            ]);

            const courseId = res.rows[0].id;

            // Generate some sections and lessons for each course
            for (let s = 1; s <= 2; s++) {
                const secRes = await client.query(`
                    INSERT INTO sections (course_id, title, "order")
                    VALUES ($1, $2, $3) RETURNING id
                `, [courseId, `Section ${s}`, s]);

                const sectionId = secRes.rows[0].id;

                for (let l = 1; l <= 3; l++) {
                    await client.query(`
                        INSERT INTO lessons (section_id, course_id, title, type, "order", preview)
                        VALUES ($1, $2, $3, $4, $5, $6)
                    `, [sectionId, courseId, `Lesson ${l} for Section ${s}`, 'video', l, l === 1]);
                }
            }
        }

        console.log("Successfully added 4 courses with sections and lessons!");
        client.release();
        process.exit(0);

    } catch (err) {
        console.error("Error seeding courses: ", err);
        process.exit(1);
    }
};

seedCourses();
