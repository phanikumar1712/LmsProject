const http = require('http');

const API_URL = 'http://localhost:5000/api';

const users = [
    { email: 'superadmin@lms.com', password: 'superadmin', role: 'SUPER_ADMIN' },
    { email: 'admin@demo.com', password: 'demo123', role: 'ADMIN' },
    { email: 'instructor@demo.com', password: 'demo123', role: 'INSTRUCTOR' },
    { email: 'student@demo.com', password: 'demo123', role: 'STUDENT' }
];

async function fetchJSON(path, options = {}) {
    return new Promise((resolve, reject) => {
        const req = http.request(API_URL + path, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: data ? JSON.parse(data) : null });
                } catch (e) {
                    resolve({ status: res.statusCode, data });
                }
            });
        });
        req.on('error', reject);
        if (options.body) req.write(options.body);
        req.end();
    });
}

async function run() {
    console.log('Testing Flows for all 4 users...\n');
    for (const u of users) {
        console.log(`--- Testing as ${u.role} (${u.email}) ---`);
        
        // Login
        const loginRes = await fetchJSON('/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: u.email, password: u.password })
        });
        
        if (loginRes.status !== 200) {
            console.error(`❌ Login failed for ${u.email}:`, loginRes.status, loginRes.data);
            continue;
        }
        
        const token = loginRes.data.token;
        const id = loginRes.data.user.id;
        console.log(`✅ Login successful. Id: ${id}`);
        
        const reqOpts = { headers: { 'Authorization': 'Bearer ' + token } };
        
        // Test /auth/me
        const meRes = await fetchJSON('/auth/me', reqOpts);
        console.log(meRes.status === 200 ? `✅ /auth/me OK` : `❌ /auth/me Failed: ${meRes.status}`);

        // Role-specific tests
        if (u.role === 'STUDENT') {
            const enroll = await fetchJSON(`/enrollments/student/${id}`, reqOpts);
            console.log(enroll.status === 200 ? `✅ /enrollments/student OK` : `❌ /enrollments/student Failed: ${enroll.status}`);
            
            const wishlist = await fetchJSON(`/wishlist`, reqOpts);
             console.log(wishlist.status === 200 ? `✅ /wishlist OK` : `❌ /wishlist Failed: ${wishlist.status}`);
        }
        else if (u.role === 'INSTRUCTOR') {
            const courses = await fetchJSON(`/courses/instructor/${id}`, reqOpts);
            console.log(courses.status === 200 ? `✅ /courses/instructor OK` : `❌ /courses/instructor Failed: ${courses.status}`);
            
            const stats = await fetchJSON(`/stats/instructor/${id}`, reqOpts);
            console.log(stats.status === 200 ? `✅ /stats/instructor OK` : `❌ /stats/instructor Failed: ${stats.status}`);
        }
        else if (u.role === 'ADMIN' || u.role === 'SUPER_ADMIN') {
            const usersList = await fetchJSON(`/users`, reqOpts);
            console.log(usersList.status === 200 ? `✅ /users OK` : `❌ /users Failed: ${usersList.status}`);
            
            const stats = await fetchJSON(`/stats/platform`, reqOpts);
             console.log(stats.status === 200 ? `✅ /stats/platform OK` : `❌ /stats/platform Failed: ${stats.status}`);
        }
        console.log('\n');
    }
}
run();
