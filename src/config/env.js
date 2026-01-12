const dotenv = require('dotenv');

// Load env vars
dotenv.config();

const getEnv = (key, defaultValue) => {
    const value = process.env[key];
    if (value === undefined || value === '') {
        if (defaultValue !== undefined) {
            return defaultValue;
        }
    }
    return value;
};

const config = {
    env: getEnv('NODE_ENV', 'development'),
    port: getEnv('PORT', 3000),
    frontendUrl: getEnv('FRONTEND_URL', 'http://localhost:3000'),

    aws: {
        region: getEnv('AWS_REGION'),
        accessKeyId: getEnv('AWS_ACCESS_KEY_ID'),
        secretAccessKey: getEnv('AWS_SECRET_ACCESS_KEY'),
    },

    assets: {
        ghRepo: getEnv('ASSET_GH_REPO'),
        ghBranch: getEnv('ASSET_GH_BRANCH'),
        signatureTtl: parseInt(getEnv('ASSET_SIGNATURE_TTL', '3600'), 10),
        allowedExt: getEnv('ASSET_ALLOWED_EXT', 'jpg,jpeg,png,gif,pdf').split(','),
    },

    rateLimit: {
        windowMs: parseInt(getEnv('RATE_LIMIT_WINDOW', '900000'), 10), // 15 minutes default
        max: parseInt(getEnv('RATE_LIMIT_MAX', '100'), 10),
    },

    jwtSecret: getEnv('JWT_SECRET'),

    turnstile: {
        secretKey: getEnv('TURNSTILE_SECRET_KEY', ''), // User provided default for now
    }
};

module.exports = config;
