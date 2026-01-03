const crypto = require('crypto');
const dotenv = require('dotenv');
dotenv.config();

// Algorithm and Key setup
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex'); // Must be 256 bits (32 chars)
const IV_LENGTH = 16; // For AES, this is always 16
const ALGORITHM = 'aes-256-cbc';

/**
 * Encrypt text
 * @param {string} text 
 * @returns {string} iv:encryptedText
 */
const encrypt = (text) => {
    if (!text) return null;
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
};

/**
 * Decrypt text
 * @param {string} text - format iv:encryptedText
 * @returns {string} decrypted string
 */
const decrypt = (text) => {
    if (!text) return null;
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
};

/**
 * Hash text (One-way) - Good for verifying data integrity but not password (use Bcrypt for passwords)
 * @param {string} text 
 * @returns {string} hex hash
 */
const hash = (text) => {
    return crypto.createHash('sha256').update(text).digest('hex');
};

module.exports = { encrypt, decrypt, hash };
