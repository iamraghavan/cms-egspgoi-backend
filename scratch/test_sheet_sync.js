const axios = require('axios');

// Simulate a Google Sheet row POST
const mockSheetRow = {
    id: 'l:test_sheet_id_123',
    created_time: '2026-04-14T11:45:00-05:00',
    full_name: 'Sheet Test User',
    phone_number: 'p:+919876543211',
    city: 'Nagapattinam',
    course_interested: 'B.Tech IT'
};

async function testSheetSync() {
    console.log('--- TESTING GOOGLE SHEET SYNC ENDPOINT ---');
    try {
        // We'll test the controller directly to avoid needing a running server
        const { handleGoogleSheetLead } = require('../src/controllers/metaWebhookController');
        
        const req = { body: mockSheetRow };
        const res = {
            status: (code) => {
                console.log(`Response Status: ${code}`);
                return { json: (msg) => console.log('Response JSON:', JSON.stringify(msg, null, 2)) };
            }
        };

        await handleGoogleSheetLead(req, res);
    } catch (err) {
        console.error('Test failed:', err);
    }
}

testSheetSync();
