const config = require('./src/config/env');

console.log('--- Environment Configuration Verification ---');
console.log('Frontend URL:', config.frontendUrl);
console.log('AWS Region:', config.aws.region);
console.log('Rate Limit Window:', config.rateLimit.windowMs);
console.log('Rate Limit Max:', config.rateLimit.max);
console.log('Asset GH Repo:', config.assets.ghRepo);
console.log('Asset Signature TTL:', config.assets.signatureTtl);

if (config.rateLimit.windowMs === 900000 && config.rateLimit.max === 100) {
    console.log('\n[SUCCESS] Rate limit configuration loaded correctly.');
} else {
    console.log('\n[FAIL] Rate limit configuration mismatch.');
}

if (process.env.AWS_REGION && process.env.AWS_REGION === config.aws.region) {
    console.log('[SUCCESS] AWS Region loaded correctly from .env');
} else {
    console.log('[FAIL] AWS Region mismatch or missing.');
}

console.log('--------------------------------------------');
