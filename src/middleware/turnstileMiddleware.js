const axios = require('axios');
const config = require('../config/env');
const { sendError } = require('../utils/responseUtils');

const validateTurnstile = async (req, res, next) => {
    // If no secret key is configured, skip validation (Dev Mode safe-guard)
    // Or if the request specifically asks to bypass via a secure header (not recommended for prod)
    if (!config.turnstile.secretKey || config.turnstile.secretKey === 'default_secret') {
        console.warn('Turnstile Skiped: No Secret Key Configured');
        return next();
    }

    const token = req.body['cf-turnstile-response'] || req.headers['cf-turnstile-response'];

    if (!token) {
        // Optional Turnstile: If token is missing, just proceed.
        // Only validate if a token is actually provided.
        return next();
    }

    try {
        const formData = new URLSearchParams();
        formData.append('secret', config.turnstile.secretKey);
        formData.append('response', token);
        formData.append('remoteip', req.ip);

        const response = await axios.post('https://challenges.cloudflare.com/turnstile/v0/siteverify', formData);
        const data = response.data;

        if (data.success) {
            next();
        } else {
            console.error('Turnstile Validation Failed:', data['error-codes']);
            return sendError(res, { message: 'Captcha Validation Failed', details: data['error-codes'] }, 'Turnstile Validation', 403);
        }
    } catch (error) {
        console.error('Turnstile Error:', error.message);
        // Fail open or closed depending on security posture. Let's fail open if Cloudflare is down but log it foundly?
        // Actually, for high security, we should fail closed.
        return sendError(res, { message: 'Captcha Verification Error' }, 'Turnstile Validation', 500);
    }
};

module.exports = { validateTurnstile };
