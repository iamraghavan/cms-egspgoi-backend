const axios = require('axios');

const sendEmail = async (to, subject, text, html) => {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    console.warn('SendGrid API Key not set. Email not sent.');
    return;
  }

  try {
    await axios.post(
      'https://api.sendgrid.com/v3/mail/send',
      {
        personalizations: [{ to: [{ email: to }] }],
        from: { email: 'noreply@example.com' }, // Replace with verified sender
        subject: subject,
        content: [
          { type: 'text/plain', value: text },
          { type: 'text/html', value: html || text }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log(`Email sent to ${to}`);
  } catch (error) {
    console.error('SendGrid Error:', error.response ? error.response.data : error.message);
  }
};

module.exports = { sendEmail };
