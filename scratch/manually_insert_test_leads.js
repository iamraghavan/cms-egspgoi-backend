const leadService = require('../src/services/leadService');
const logger = require('../src/utils/logger');

const dummyLeads = [
    {
        meta_lead_id: '2033661517256112',
        name: 'Test Lead: Dummy Full Name',
        phone: '+919999999999', // Placeholder as sample didn't have real number
        email: 'test1@example.com',
        course: 'Test: Dummy Course',
        district: 'Test: Dummy City',
        source_website: 'facebook.com',
        college: 'Meta Ads',
        admission_year: '2026',
        form_id: '2000268247235731'
    },
    {
        meta_lead_id: '926810776866606',
        name: 'Test Lead: Dummy Full Name (2)',
        phone: '+919999999998',
        email: 'test2@example.com',
        course: 'Test: Dummy Course',
        district: 'Test: Dummy City',
        source_website: 'facebook.com',
        college: 'Meta Ads',
        admission_year: '2026'
    },
    {
        meta_lead_id: '2472711163173319',
        name: 'Test Lead: Dummy Full Name (3)',
        phone: '+919999999997',
        email: 'test3@example.com',
        course: 'Test: Dummy Course',
        district: 'Test: Dummy City',
        source_website: 'facebook.com',
        college: 'Meta Ads',
        admission_year: '2026'
    },
    {
        meta_lead_id: '26539342175706213',
        name: 'Test Lead: Dummy Full Name (4)',
        phone: '+919999999996',
        email: 'test4@example.com',
        course: 'Test: Dummy Course',
        district: 'Test: Dummy City',
        source_website: 'facebook.com',
        college: 'Meta Ads',
        admission_year: '2026'
    },
    {
        meta_lead_id: '1620662135814280',
        name: 'Test Lead: Dummy Full Name (5)',
        phone: '+919999999995',
        email: 'test5@example.com',
        course: 'Test: Dummy Course',
        district: 'Test: Dummy City',
        source_website: 'facebook.com',
        college: 'Meta Ads',
        admission_year: '2026'
    }
];

async function insertAll() {
    console.log(`--- INJECTING ${dummyLeads.length} TEST LEADS ---`);
    for (const lead of dummyLeads) {
        try {
            const result = await leadService.createLeadInDB(lead, true, 'MANUAL_INJECTION');
            if (result.isDuplicate) {
                console.log(`Lead ${lead.meta_lead_id} already exists. Skipped.`);
            } else {
                console.log(`Lead ${lead.meta_lead_id} successfully stored!`);
            }
        } catch (err) {
            console.error(`Failed to store lead ${lead.meta_lead_id}:`, err.message);
        }
    }
}

insertAll();
