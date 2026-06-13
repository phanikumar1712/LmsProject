const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://neondb_owner:REDACTED@ep-withered-mode-am2a8xup.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require' });
client.connect().then(() => {
    return client.query("SELECT email, reset_otp FROM users WHERE email = 'test_student_123@example.com'");
}).then(res => {
    console.log(res.rows);
    client.end();
}).catch(console.error);
