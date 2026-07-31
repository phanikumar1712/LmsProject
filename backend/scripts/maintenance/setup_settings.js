const { Client } = require('pg');
require('dotenv').config();

async function run() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        // Create settings table
        await client.query(`
            CREATE TABLE IF NOT EXISTS platform_settings (
                key TEXT PRIMARY KEY,
                value JSONB NOT NULL,
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log("✅ platform_settings table ensured");

        // Insert default settings if not exists
        const defaults = {
            siteName: 'EduNexus LMS',
            siteTagline: 'Learn Without Limits',
            supportEmail: 'support@edunexus.com',
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
            INSERT INTO platform_settings (key, value) 
            VALUES ('global', $1)
            ON CONFLICT (key) DO NOTHING;
        `, [JSON.stringify(defaults)]);

        console.log("✅ Default platform settings initialized");

    } catch (e) {
        console.error("❌ Error initializing settings table:", e.message);
    } finally {
        await client.end().catch(() => { });
    }
}

run();
