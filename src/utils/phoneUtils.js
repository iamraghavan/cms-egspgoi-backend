const { parsePhoneNumber, isValidNumber } = require('libphonenumber-js');

/**
 * Formats a phone number to E.164 format.
 * @param {string} phone - The input phone number.
 * @param {string} defaultCountry - The default country code (ISO 3166-1 alpha-2), e.g., 'IN'.
 * @returns {string|null} - The formatted phone number (e.g., '+919876543210') or null if invalid.
 */
const formatPhoneNumber = (phone, defaultCountry = 'IN') => {
    try {
        if (!phone) return null;
        
        // Parse the phone number
        const phoneNumber = parsePhoneNumber(String(phone), defaultCountry);
        
        // Check if valid
        if (phoneNumber && phoneNumber.isValid()) {
            return phoneNumber.number; // Returns E.164 format
        }
        
        return null;
    } catch (error) {
        return null;
    }
};

const getNationalNumber = (phone, defaultCountry = 'IN') => {
    try {
        if (!phone) return null;
        
        const phoneNumber = parsePhoneNumber(String(phone), defaultCountry);
        
        if (phoneNumber && phoneNumber.isValid()) {
            return phoneNumber.nationalNumber;
        }
        
        return null;
    } catch (error) {
        return null;
    }
};

module.exports = { formatPhoneNumber, getNationalNumber };
