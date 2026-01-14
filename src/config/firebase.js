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
                console.log('[Firebase] Loaded credentials from FIREBASE_SERVICE_ACCOUNT');
            } catch (e) {
                console.error('[Firebase] Failed to parse FIREBASE_SERVICE_ACCOUNT JSON:', e);
                throw new Error('Invalid FIREBASE_SERVICE_ACCOUNT JSON');
            }
        } else {
            console.warn('[Firebase] FIREBASE_SERVICE_ACCOUNT not set. Using Application Default Credentials.');
            credential = admin.credential.applicationDefault();
        }

        if (!process.env.FIREBASE_DB_URL) {
            console.error('[Firebase] FIREBASE_DB_URL is missing!');
        } else {
            console.log('[Firebase] Using Database URL:', process.env.FIREBASE_DB_URL);
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
