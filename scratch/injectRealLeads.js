const leadService = require('../src/services/leadService');

const realLeads = [
    {
        meta_lead_id: '1260962939548493',
        name: 'Yameii 🤎',
        phone: '+917539918238',
        email: null,
        course: 'engineering',
        district: 'Karaikal',
        source_website: 'facebook.com',
        college: 'ADS',
        admission_year: '2026',
        created_at: '2026-04-14T03:12:01-05:00'
    },
    {
        meta_lead_id: '1017803754757066',
        name: '🄱🄰🅅🅈🄰',
        phone: '+918940988521',
        email: null,
        course: 'pharmacy',
        district: 'Coimbotore',
        source_website: 'facebook.com',
        college: 'ADS',
        admission_year: '2026',
        created_at: '2026-04-14T03:13:52-05:00'
    },
    {
        meta_lead_id: '1302335948414188',
        name: 'rakshana',
        phone: '+919840670509',
        email: null,
        course: 'arts_&_science',
        district: 'Nagapattinam',
        source_website: 'facebook.com',
        college: 'ADS',
        admission_year: '2026',
        created_at: '2026-04-14T03:37:13-05:00'
    },
    {
        meta_lead_id: '2175568086624980',
        name: 'Archana Saravanan',
        phone: '+916382087377',
        email: null,
        course: 'engineering',
        district: 'Nagapattinam',
        source_website: 'facebook.com',
        college: 'ADS',
        admission_year: '2026',
        created_at: '2026-04-14T06:56:19-05:00'
    },
    {
        meta_lead_id: '2160551118065569',
        name: '𝗻𝗮𝘃𝗶𝗻',
        phone: '+918270930980',
        email: null,
        course: 'arts_&_science',
        district: 'Nagapattinam',
        source_website: 'facebook.com',
        college: 'ADS',
        admission_year: '2026',
        created_at: '2026-04-14T07:57:16-05:00'
    },
    {
        meta_lead_id: '2044880399427735',
        name: 'Indhu',
        phone: '+918667830092',
        email: null,
        course: 'engineering',
        district: 'Hosur',
        source_website: 'facebook.com',
        college: 'ADS',
        admission_year: '2026',
        created_at: '2026-04-14T08:17:00-05:00'
    },
    {
        meta_lead_id: '1225758289359812',
        name: 'Riyas Valangai',
        phone: '+919843758862',
        email: null,
        course: 'engineering',
        district: 'valangaiman',
        source_website: 'facebook.com',
        college: 'ADS',
        admission_year: '2026',
        created_at: '2026-04-14T12:41:03-05:00'
    }
];

async function inject() {
    console.log(`--- INJECTING ${realLeads.length} REAL LEADS ---`);
    for (const lead of realLeads) {
        try {
            const result = await leadService.createLeadInDB(lead, true, 'MANUAL_INJECTION_REAL');
            if (result.isDuplicate) {
                console.log(`Lead ${lead.meta_lead_id} (${lead.name}) already exists. Skipped.`);
            } else {
                console.log(`Lead ${lead.meta_lead_id} (${lead.name}) successfully stored!`);
            }
        } catch (err) {
            console.error(`Failed to store lead ${lead.name}:`, err.message);
        }
    }
}

inject();
