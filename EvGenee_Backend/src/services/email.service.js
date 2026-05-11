const nodemailer = require('nodemailer');
const { NODEMAILER_USER, NODEMAILER_PASS, NODEMAILER_PORT } = require('../config/config');

const transporter = nodemailer.createTransport({
    secure: true,
    host: "smtp.gmail.com",
    port: Number(NODEMAILER_PORT),
    auth: {
        user: NODEMAILER_USER,
        pass: NODEMAILER_PASS
    }
});

/**
 * Generates a professional branded HTML template for EvGenee
 * @param {string} title - The heading of the email
 * @param {string} content - The main body content (HTML allowed)
 * @returns {string} Branded HTML string
 */
const generateEmailTemplate = (title, content) => {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>EvGenee</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap');
            body { margin: 0; padding: 0; font-family: 'DM Sans', Arial, sans-serif; background-color: #000814; color: #e2e8f0; }
            .wrapper { width: 100%; background-color: #000814; padding: 40px 0; }
            .main { background-color: #0a1122; margin: 0 auto; width: 100%; max-width: 600px; border-spacing: 0; border-radius: 24px; overflow: hidden; border: 1px solid rgba(255,255,255,0.08); box-shadow: 0 20px 50px rgba(0,0,0,0.5); }
            .header { background: linear-gradient(135deg, #0a1122 0%, #000814 100%); padding: 40px 30px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.05); }
            .logo-text { color: #ffffff; font-size: 26px; font-weight: 800; letter-spacing: -0.5px; margin: 0; text-transform: none; }
            .logo-accent { color: #10b981; }
            .content { padding: 40px 40px; line-height: 1.6; }
            .title { font-size: 24px; font-weight: 700; color: #ffffff; margin-bottom: 24px; text-align: center; }
            .body-text { color: #94a3b8; font-size: 16px; margin-bottom: 24px; }
            .otp-box { background: rgba(16,185,129,0.05); border: 1px solid rgba(16,185,129,0.2); border-radius: 16px; padding: 30px; text-align: center; margin: 30px 0; }
            .otp-code { font-size: 42px; font-weight: 800; color: #10b981; letter-spacing: 10px; margin: 0; text-shadow: 0 0 20px rgba(16,185,129,0.2); }
            .footer { background-color: #000814; padding: 40px 30px; text-align: center; border-top: 1px solid rgba(255,255,255,0.05); }
            .footer-text { font-size: 12px; color: #475569; margin-bottom: 8px; font-weight: 500; }
            .social-link { display: inline-block; margin: 0 12px; color: #10b981; text-decoration: none; font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; }
            .btn { display: inline-block; padding: 14px 36px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff !important; text-decoration: none; border-radius: 100px; font-weight: 700; font-size: 14px; margin-top: 20px; box-shadow: 0 10px 20px rgba(16,185,129,0.2); }
            .highlight { color: #10b981; font-weight: 600; }
        </style>
    </head>
    <body>
        <div class="wrapper">
            <table class="main" align="center">
                <tr>
                    <td class="header">
                        <div class="logo-text">Ev<span class="logo-accent">Genee</span></div>
                    </td>
                </tr>
                <tr>
                    <td class="content">
                        <h2 class="title">${title}</h2>
                        <div class="body-text">${content}</div>
                    </td>
                </tr>
                <tr>
                    <td class="footer">
                        <p class="footer-text">© ${new Date().getFullYear()} EvGenee Network Pvt. Ltd.</p>
                        <p class="footer-text">The premium EV charging infrastructure of India.</p>
                        <div style="margin-top: 25px;">
                            <a href="#" class="social-link">Dashboard</a>
                            <a href="#" class="social-link">Support</a>
                            <a href="#" class="social-link">Privacy</a>
                        </div>
                    </td>
                </tr>
            </table>
        </div>
    </body>
    </html>
    `;
};

const sendEmail = async ({ to, subject, title, content }) => {
    try {
        const html = generateEmailTemplate(title, content);
        const info = await transporter.sendMail({
            from: `"EvGenee" <${NODEMAILER_USER}>`,
            to,
            subject,
            html
        });
        console.log(`[EmailService] Email sent: ${info.messageId}`);
        return info;
    } catch (error) {
        console.error(`[EmailService] Error sending email:`, error.message);
        throw error;
    }
};

module.exports = {
    sendEmail,
    generateEmailTemplate
};
