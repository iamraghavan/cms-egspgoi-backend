const crypto = require('crypto');
const { getISTTimestamp } = require('./timeUtils');

/**
 * Generates a unique Lead Reference ID in the format:
 * egsp-admission-YYYYMMDD-XXXXXX
 * Where XXXXXX is a random 6-digit number.
 */
const generateLeadRef = () => {
    const now = new Date();
    // Convert to IST for the date part
    const offset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + offset);
    
    const year = istDate.getUTCFullYear();
    const month = String(istDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(istDate.getUTCDate()).padStart(2, '0');
    
    const dateStr = `${year}${month}${day}`;
    
    // Generate 6 random digits
    const randomDigits = crypto.randomInt(100000, 999999).toString();
    
    return `egsp-admission-${dateStr}-${randomDigits}`;
};

module.exports = { generateLeadRef };
