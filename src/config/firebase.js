const admin = require('firebase-admin');
const logger = require('../utils/logger');

let db = null;

try {
    // Check if already initialized to avoid "Default app already exists" error
    if (!admin.apps.length) {
        const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT;
        let credential;

        if (serviceAccountStr) {
            // Parse JSON service account from env if provided
            try {
                const serviceAccount = JSON.parse(serviceAccountStr);
                credential = admin.credential.cert(serviceAccount);
            } catch (e) {
                logger.error('Failed to parse FIREBASE_SERVICE_ACCOUNT JSON', e);
                throw new Error('Invalid FIREBASE_SERVICE_ACCOUNT JSON');
            }
        } else {
            // Fallback to Application Default Credentials (e.g. invalid in standard Vercel unless vars set differently)
            // Or if using specific env vars for project ID etc.
            // For development/standard setup, user usually provides key.
            credential = admin.credential.applicationDefault();
        }

        admin.initializeApp({
            credential: credential,
            databaseURL: process.env.FIREBASE_DB_URL
        });
        logger.info('Firebase Admin Initialized');
    }

    db = admin.database();

} catch (error) {
    logger.error('Firebase Initialization Error:', error);
}

module.exports = { db, admin };
