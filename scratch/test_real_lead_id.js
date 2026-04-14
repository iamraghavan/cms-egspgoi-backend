const { handleMetaLead } = require('../src/controllers/metaWebhookController');
const logger = require('../src/utils/logger');

// Mock req/res
const req = {
    body: {
        entry: [
            {
                changes: [
                    {
                        value: {
                            leadgen_id: 'l:2033661517256112', // One of the IDs from your message
                            form_id: '2000268247235731',
                            page_id: 'EGS Pillay Group...' // Not strictly needed for logic but good for logs
                        }
                    }
                ]
            }
        ]
    }
};

const res = {
    status: (code) => {
        console.log(`Response Status: ${code}`);
        return {
            send: (msg) => console.log(`Response Message: ${msg}`)
        };
    }
};

async function testWithRealId() {
    console.log('--- TESTING REAL LEAD ID FETCH ---');
    try {
        await handleMetaLead(req, res);
    } catch (err) {
        console.error('Test failed:', err);
    }
}

testWithRealId();
