require('dotenv').config({ path: './.env' });
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

async function testMail() {
    console.log('Using API Key:', process.env.RESEND_API_KEY);
    try {
        const { data, error } = await resend.emails.send({
            from: 'onboarding@resend.dev',
            to: 'delivered@resend.dev', // Resend's test email
            subject: 'Test connection from EduNexus',
            html: '<p>If you see this, your Resend API key is working correctly!</p>'
        });

        if (error) {
            console.error('❌ Resend Error:', error);
        } else {
            console.log('✅ Success! Email sent. ID:', data.id);
        }
    } catch (err) {
        console.error('💥 Execution Error:', err.message);
    }
}

testMail();
