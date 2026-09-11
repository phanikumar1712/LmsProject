const { Resend } = require('resend');

// Lazy-init so a missing RESEND_API_KEY fails on the email endpoint with a
// clear error instead of crashing the whole app at module load (important on
// serverless where env misconfiguration would otherwise take every route down).
let resend = null;
const getResend = () => {
    if (!process.env.RESEND_API_KEY) {
        throw new Error('RESEND_API_KEY is not configured. Email sending is unavailable.');
    }
    if (!resend) resend = new Resend(process.env.RESEND_API_KEY);
    return resend;
};

const sendOTPEmail = async (email, otp) => {
    console.log(`[DEBUG] OTP for ${email}: ${otp}`);
    try {
        const { data, error } = await getResend().emails.send({
            from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
            to: email,
            subject: 'Your Password Reset OTP',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 10px;">
                    <h2 style="color: #333; text-align: center;">Password Reset Request</h2>
                    <p>Hello,</p>
                    <p>We received a request to reset your password. Use the following One-Time Password (OTP) to proceed:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #4F46E5; background-color: #F3F4F6; padding: 10px 20px; border-radius: 5px;">${otp}</span>
                    </div>
                    <p>This OTP is valid for 10 minutes. If you did not request a password reset, please ignore this email.</p>
                    <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;">
                    <p style="font-size: 12px; color: #666; text-align: center;">This is an automated message from your LMS Platform.</p>
                </div>
            `,
        });

        if (error) {
            console.error('Resend Error:', error);
            return { success: false, error };
        }

        return { success: true, data };
    } catch (err) {
        console.error('Mail Send Catch Error:', err);
        return { success: false, error: err.message };
    }
};

module.exports = { sendOTPEmail };
