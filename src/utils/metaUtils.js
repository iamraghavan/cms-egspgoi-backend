/**
 * Utility for Meta Graph API data normalization
 */

/**
 * Strips common Meta prefixes (l:, f:, p:) from a string
 * @param {string|number} value 
 * @returns {string} Cleaned string
 */
const stripMetaPrefix = (value) => {
    if (!value) return value;
    return value.toString().replace(/^[lfp]:/i, '');
};

/**
 * Normalizes Meta Lead field_data array into a flat object
 * @param {Array} fieldData - Meta's field_data array
 * @param {Object} extraMetadata - Optional extra data (id, created_time, etc.)
 * @returns {Object} Normalized lead object
 */
const normalizeMetaLead = (fieldData, extraMetadata = {}) => {
    const normalized = {
        meta_lead_id: stripMetaPrefix(extraMetadata.id) || null,
        name: 'Meta Lead', // Fallback
        email: null,
        phone: null,
        state: null,
        district: null,
        course: 'Unknown', // Default as per schema required fields
        college: 'Meta Ads', // Default source
        admission_year: new Date().getFullYear().toString(),
        source_website: 'facebook.com',
        created_at: extraMetadata.created_time || null,
        form_data: {}
    };

    if (!fieldData || !Array.isArray(fieldData)) return normalized;

    fieldData.forEach(field => {
        const key = field.name;
        const value = field.values && field.values.length > 0 ? field.values[0] : null;

        if (!key || !value) return;

        // Store everything in form_data for backup
        normalized.form_data[key] = value;

        // Map to specific CRM fields
        switch (key.toLowerCase()) {
            case 'full_name':
            case 'name':
            case 'first_name':
                normalized.name = value;
                break;
            case 'email':
                normalized.email = value;
                break;
            case 'phone_number':
            case 'phone':
                // Strip p: prefix
                const cleanPhone = stripMetaPrefix(value);
                // Prepend + if missing
                normalized.phone = cleanPhone.startsWith('+') ? cleanPhone : `+${cleanPhone}`;
                break;
            case 'state':
                normalized.state = value;
                break;
            case 'city':
                normalized.district = value;
                break;
            case 'course':
            case 'course_interested':
            case 'what_course_are_you_interested_in?':
                normalized.course = value;
                break;
            case 'college':
                normalized.college = value;
                break;
        }
    });

    return normalized;
};

module.exports = {
    normalizeMetaLead,
    stripMetaPrefix
};

