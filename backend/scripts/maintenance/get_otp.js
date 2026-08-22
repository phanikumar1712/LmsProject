// Dev helper: print the reset OTP for a given email.
// Uses DATABASE_URL from backend/.env — never hardcode credentials.
require('dotenv').config();
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect().then(() => {
    return client.query("SELECT email, reset_otp FROM users WHERE email = 'test_student_123@example.com'");
}).then(res => {
    console.log(res.rows);
    client.end();
}).catch(console.error);
