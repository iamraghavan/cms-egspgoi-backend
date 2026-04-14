/**
 * Utility for Meta Graph API data normalization
 */

/**
 * Normalizes Meta Lead field_data array into a flat object
 * @param {Array} fieldData - Meta's field_data array
 * @returns {Object} Normalized lead object
 */
const normalizeMetaLead = (fieldData) => {
    const normalized = {
        name: 'Meta Lead', // Fallback
        email: null,
        phone: null,
        state: null,
        district: null,
        course: 'Unknown', // Default as per schema required fields
        college: 'Meta Ads', // Default source
        admission_year: new Date().getFullYear().toString(),
        source_website: 'facebook.com',
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
                // Meta test tool sometimes prefixes with 'p:'
                let rawPhone = value.replace(/^p:/, '');
                // Meta phone numbers often start with + or are just digits. 
                // Our schema expects E.164 pattern: /^\+[1-9]\d{1,14}$/
                normalized.phone = rawPhone.startsWith('+') ? rawPhone : `+${rawPhone}`;
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
    normalizeMetaLead
};
