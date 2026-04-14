const { normalizeMetaLead } = require('../src/utils/metaUtils');

const mockFieldData = [
    { name: 'full_name', values: ['Raghavan Jeeva'] },
    { name: 'email', values: ['raghavan@example.com'] },
    { name: 'phone_number', values: ['p:+919876543210'] },
    { name: 'city', values: ['Chennai'] },
    { name: 'state', values: ['Tamil Nadu'] },
    { name: 'course_interested', values: ['B.Tech CSE'] }
];

const result = normalizeMetaLead(mockFieldData);
console.log('Normalized Result:', JSON.stringify(result, null, 2));

// Test with missing fields
const result2 = normalizeMetaLead([]);
console.log('Empty Result:', JSON.stringify(result2, null, 2));
