const axios = require('axios');
const leadService = require('../src/services/leadService');
const { normalizeMetaLead } = require('../src/utils/metaUtils');
const logger = require('../src/utils/logger');

const FORM_ID = '2000268247235731'; // From your Postman call
const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;

async function syncTestLeads() {
    if (!ACCESS_TOKEN) {
        console.error('Error: META_ACCESS_TOKEN is not set in .env');
        return;
    }

    console.log(`--- SYNCING TEST LEADS FOR FORM: ${FORM_ID} ---`);

    try {
        const url = `https://graph.facebook.com/v25.0/${FORM_ID}/test_leads`;
        const response = await axios.get(url, {
            params: { access_token: ACCESS_TOKEN }
        });

        const testLeads = response.data.data;
        if (!testLeads || testLeads.length === 0) {
            console.log('No test leads found to sync.');
            return;
        }

        console.log(`Found ${testLeads.length} test leads. Starting sync...`);

        for (const metaLead of testLeads) {
            const normalizedData = normalizeMetaLead(metaLead.field_data, {
                id: metaLead.id,
                created_time: metaLead.created_time
            });

            // Add UTM/Metadata
            normalizedData.form_id = FORM_ID;
            normalizedData.utm_params = {
                utm_source: 'fb_test_tool',
                utm_medium: 'sync_script'
            };

            const result = await leadService.createLeadInDB(normalizedData, true, 'SYNC_SCRIPT');
            
            if (result.isDuplicate) {
                console.log(`Lead ${metaLead.id} already exists. Skipped.`);
            } else {
                console.log(`Lead ${metaLead.id} successfully synced (${normalizedData.name}).`);
            }
        }

        console.log('\n--- SYNC COMPLETED ---');

    } catch (error) {
        console.error('Sync failed:', error.response?.data || error.message);
    }
}

syncTestLeads();
