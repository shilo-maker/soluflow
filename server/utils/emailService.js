const nodemailer = require('nodemailer');

// Email service that supports multiple providers
const sendVerificationEmail = async (email, token, username) => {
  try {
    const baseUrl = process.env.CLIENT_URL || 'http://localhost:3001';
    const verificationUrl = `${baseUrl}/verify-email?token=${token}`;
    const emailFrom = process.env.EMAIL_FROM || '"SoluFlow" <noreply@soluflow.com>';

    // Email content (HTML + plain text)
    const htmlContent = `
      <!DOCTYPE html>
      <html dir="ltr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Email - SoluFlow</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #4ECDC4 0%, #44A08D 100%); padding: 40px 20px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 28px;">SoluFlow</h1>
                  </td>
                </tr>

                <!-- Content -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <h2 style="color: #333333; margin: 0 0 20px 0; font-size: 24px;">Welcome to SoluFlow!</h2>
                    <p style="color: #666666; font-size: 16px; line-height: 1.5; margin: 0 0 20px 0;">
                      Hi <strong>${username}</strong>,
                    </p>
                    <p style="color: #666666; font-size: 16px; line-height: 1.5; margin: 0 0 20px 0;">
                      Thank you for registering with SoluFlow. To complete your registration and start using your account, please verify your email address.
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="padding: 20px 0;">
                          <a href="${verificationUrl}" style="background: linear-gradient(135deg, #4ECDC4 0%, #44A08D 100%); color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 5px; font-size: 16px; font-weight: bold; display: inline-block;">
                            Verify Email Address
                          </a>
                        </td>
                      </tr>
                    </table>
                    <p style="color: #666666; font-size: 14px; line-height: 1.5; margin: 20px 0 0 0;">
                      Or copy and paste this link into your browser:
                    </p>
                    <p style="color: #4ECDC4; font-size: 14px; word-break: break-all; margin: 10px 0 20px 0;">
                      ${verificationUrl}
                    </p>
                    <p style="color: #999999; font-size: 13px; line-height: 1.5; margin: 20px 0 0 0; padding-top: 20px; border-top: 1px solid #eeeeee;">
                      This verification link will expire in 24 hours.
                    </p>
                    <p style="color: #999999; font-size: 13px; line-height: 1.5; margin: 10px 0 0 0;">
                      If you didn't create this account, you can safely ignore this email.
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #f8f8f8; padding: 20px 30px; text-align: center; border-top: 1px solid #eeeeee;">
                    <p style="color: #999999; font-size: 12px; margin: 0;">
                      © ${new Date().getFullYear()} SoluFlow. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const textContent = `
Welcome to SoluFlow!

Hi ${username},

Thank you for registering with SoluFlow. To complete your registration and start using your account, please verify your email address.

Verify your email by clicking this link:
${verificationUrl}

This verification link will expire in 24 hours.

If you didn't create this account, you can safely ignore this email.

© ${new Date().getFullYear()} SoluFlow. All rights reserved.
    `;

    // Choose email provider based on environment
    const emailService = process.env.EMAIL_SERVICE || 'smtp';

    if (emailService === 'resend') {
      // Use Resend API
      return await sendViaResend(email, emailFrom, htmlContent, textContent, 'Verify Your Email - SoluFlow');
    } else if (emailService === 'sendgrid') {
      // Use SendGrid API
      return await sendViaSendGrid(email, emailFrom, htmlContent, textContent, 'Verify Your Email - SoluFlow');
    } else {
      // Use SMTP (nodemailer)
      return await sendViaSMTP(email, emailFrom, htmlContent, textContent, 'Verify Your Email - SoluFlow');
    }
  } catch (error) {
    console.error('Error sending verification email:', error);
    throw new Error('Failed to send verification email');
  }
};

// Send via Resend API
async function sendViaResend(to, from, html, text, subject = 'Email from SoluFlow') {
  try {
    const axios = require('axios');

    const response = await axios.post('https://api.resend.com/emails', {
      from: from,
      to: [to],
      subject: subject,
      html: html,
      text: text
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✓ Email sent via Resend');
    console.log('  Email ID:', response.data.id);

    return { success: true, messageId: response.data.id, provider: 'resend' };
  } catch (error) {
    console.error('Resend error:', error.response?.data || error.message);
    throw error;
  }
}

// Send via SendGrid API
async function sendViaSendGrid(to, from, html, text, subject = 'Email from SoluFlow') {
  try {
    const axios = require('axios');

    const response = await axios.post('https://api.sendgrid.com/v3/mail/send', {
      personalizations: [{
        to: [{ email: to }]
      }],
      from: { email: from.match(/<(.+)>/)?.[1] || from, name: from.match(/"(.+)"/)?.[1] || 'SoluFlow' },
      subject: subject,
      content: [
        { type: 'text/plain', value: text },
        { type: 'text/html', value: html }
      ]
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✓ Email sent via SendGrid');
    console.log('  Status:', response.status);

    return { success: true, messageId: response.headers['x-message-id'], provider: 'sendgrid' };
  } catch (error) {
    console.error('SendGrid error:', error.response?.data || error.message);
    throw error;
  }
}

// Send via SMTP (nodemailer)
async function sendViaSMTP(to, from, html, text, subject = 'Email from SoluFlow') {
  let transporter;

  try {
    // Create transporter based on environment
    if (process.env.NODE_ENV === 'production' && process.env.SMTP_HOST) {
      // Production SMTP
      transporter = nodemailer.createTransporter({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
    } else if (process.env.ETHEREAL_USER && process.env.ETHEREAL_PASS) {
      // Ethereal Email (development)
      transporter = nodemailer.createTransporter({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: process.env.ETHEREAL_USER,
          pass: process.env.ETHEREAL_PASS
        }
      });
    } else {
      // Create Ethereal account on the fly
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransporter({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });
      console.log('Created temporary Ethereal account:', testAccount.user);
    }

    const mailOptions = {
      from: from,
      to: to,
      subject: subject,
      text: text,
      html: html
    };

    const info = await transporter.sendMail(mailOptions);

    console.log('✓ Email sent via SMTP');
    console.log('  Message ID:', info.messageId);

    // For development, show preview URL
    if (process.env.NODE_ENV !== 'production') {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        console.log('  Preview URL:', previewUrl);
      }
    }

    return { success: true, messageId: info.messageId, provider: 'smtp' };
  } catch (error) {
    console.error('SMTP error:', error);
    throw error;
  }
}

// Send password reset email
const sendPasswordResetEmail = async (email, token, username) => {
  try {
    const baseUrl = process.env.CLIENT_URL || 'http://localhost:3001';
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;
    const emailFrom = process.env.EMAIL_FROM || '"SoluFlow" <noreply@soluflow.com>';

    // Email content (HTML + plain text)
    const htmlContent = `
      <!DOCTYPE html>
      <html dir="ltr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password - SoluFlow</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #4ECDC4 0%, #44A08D 100%); padding: 40px 20px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 28px;">SoluFlow</h1>
                  </td>
                </tr>

                <!-- Content -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <h2 style="color: #333333; margin: 0 0 20px 0; font-size: 24px;">Reset Your Password</h2>
                    <p style="color: #666666; font-size: 16px; line-height: 1.5; margin: 0 0 20px 0;">
                      Hi <strong>${username}</strong>,
                    </p>
                    <p style="color: #666666; font-size: 16px; line-height: 1.5; margin: 0 0 20px 0;">
                      We received a request to reset your password for your SoluFlow account. Click the button below to create a new password.
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="padding: 20px 0;">
                          <a href="${resetUrl}" style="background: linear-gradient(135deg, #4ECDC4 0%, #44A08D 100%); color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 5px; font-size: 16px; font-weight: bold; display: inline-block;">
                            Reset Password
                          </a>
                        </td>
                      </tr>
                    </table>
                    <p style="color: #666666; font-size: 14px; line-height: 1.5; margin: 20px 0 0 0;">
                      If the button doesn't work, copy and paste this link into your browser:
                    </p>
                    <p style="color: #4ECDC4; font-size: 14px; word-break: break-all; margin: 10px 0 20px 0;">
                      ${resetUrl}
                    </p>
                    <p style="color: #999999; font-size: 14px; line-height: 1.5; margin: 20px 0 0 0; padding-top: 20px; border-top: 1px solid #eeeeee;">
                      <strong>This link will expire in 1 hour.</strong>
                    </p>
                    <p style="color: #999999; font-size: 14px; line-height: 1.5; margin: 10px 0 0 0;">
                      If you didn't request this password reset, please ignore this email or contact support if you have concerns.
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #f8f8f8; padding: 20px 30px; text-align: center;">
                    <p style="color: #999999; font-size: 12px; margin: 0;">
                      This is an automated message from SoluFlow. Please do not reply to this email.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const textContent = `
      SoluFlow - Reset Your Password

      Hi ${username},

      We received a request to reset your password for your SoluFlow account.

      To reset your password, visit this link:
      ${resetUrl}

      This link will expire in 1 hour.

      If you didn't request this password reset, please ignore this email or contact support if you have concerns.

      ---
      This is an automated message from SoluFlow. Please do not reply to this email.
    `;

    // Choose email provider based on environment
    const emailService = process.env.EMAIL_SERVICE || 'smtp';

    if (emailService === 'resend') {
      return await sendViaResend(email, emailFrom, htmlContent, textContent, 'Reset Your Password - SoluFlow');
    } else if (emailService === 'sendgrid') {
      return await sendViaSendGrid(email, emailFrom, htmlContent, textContent, 'Reset Your Password - SoluFlow');
    } else {
      return await sendViaSMTP(email, emailFrom, htmlContent, textContent, 'Reset Your Password - SoluFlow');
    }
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw new Error('Failed to send password reset email');
  }
};

module.exports = { sendVerificationEmail, sendPasswordResetEmail };
