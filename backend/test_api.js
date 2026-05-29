const API_URL = 'http://[::1]:5000/api';
const users = [
    { email: 'superadmin@lms.com', password: 'admin123', role: 'SUPER_ADMIN' },
    { email: 'admin@demo.com', password: 'demo123', role: 'ADMIN' },
    { email: 'instructor@demo.com', password: 'demo123', role: 'INSTRUCTOR' },
    { email: 'student@demo.com', password: 'demo123', role: 'STUDENT' }
];

async function run() {
    console.log('Testing Flows for all 4 users...\n');
    for (const u of users) {
        console.log(`--- Testing as ${u.role} (${u.email}) ---`);

        try {
            // Login
            const loginRes = await fetch(API_URL + '/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: u.email, password: u.password })
            });
            const loginData = await loginRes.json();

            if (!loginRes.ok) {
                console.error(`❌ Login failed for ${u.email}:`, loginRes.status, loginData);
                continue;
            }

            const token = loginData.token;
            const id = loginData.user.id;
            console.log(`✅ Login successful. Id: ${id}`);

            const reqOpts = { headers: { 'Authorization': 'Bearer ' + token } };

            // Test /auth/me
            const meRes = await fetch(API_URL + '/auth/me', reqOpts);
            console.log(meRes.ok ? `✅ /auth/me OK` : `❌ /auth/me Failed: ${meRes.status}`);

            // Role-specific tests
            if (u.role === 'STUDENT') {
                const enroll = await fetch(API_URL + `/enrollments/student/${id}`, reqOpts);
                console.log(enroll.ok ? `✅ /enrollments/student OK` : `❌ /enrollments/student Failed: ${enroll.status}`);

                const wishlist = await fetch(API_URL + `/wishlist`, reqOpts);
                console.log(wishlist.ok ? `✅ /wishlist OK` : `❌ /wishlist Failed: ${wishlist.status}`);
            }
            else if (u.role === 'INSTRUCTOR') {
                const courses = await fetch(API_URL + `/courses/instructor/${id}`, reqOpts);
                console.log(courses.ok ? `✅ /courses/instructor OK` : `❌ /courses/instructor Failed: ${courses.status}`);

                const stats = await fetch(API_URL + `/stats/instructor/${id}`, reqOpts);
                console.log(stats.ok ? `✅ /stats/instructor OK` : `❌ /stats/instructor Failed: ${stats.status}`);
            }
            else if (u.role === 'ADMIN' || u.role === 'SUPER_ADMIN') {
                const usersList = await fetch(API_URL + `/users`, reqOpts);
                console.log(usersList.ok ? `✅ /users OK` : `❌ /users Failed: ${usersList.status}`);

                const stats = await fetch(API_URL + `/stats/platform`, reqOpts);
                console.log(stats.ok ? `✅ /stats/platform OK` : `❌ /stats/platform Failed: ${stats.status}`);
            }
        } catch (error) {
            console.error(`❌ Error during test:`, error.message);
        }
        console.log('\n');
    }
}
run();
