const config = require('../config/env');

const verifySubmissionSecret = (req, res, next) => {
    // Allows bypassing secret if Turnstile is valid (optional dual-strategy)
    // But here we enforce the Secret Header as requested.

    // Get secret from Env or default
    const validSecret = process.env.SUBMISSION_SECRET || 'egsp_secure_submission_2025';

    const requestSecret = req.headers['x-submission-secret'];

    if (!requestSecret || requestSecret !== validSecret) {
        return res.status(403).json({
            message: 'Access Denied: Invalid Submission Secret',
            hint: 'Add header x-submission-secret'
        });
    }

    next();
};

module.exports = { verifySubmissionSecret };
