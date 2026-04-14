const { docClient } = require('../src/config/db');
const { ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { TABLE_NAME } = require('../src/models/leadModel');

async function checkLatestLeads() {
    try {
        const command = new ScanCommand({
            TableName: TABLE_NAME,
            Limit: 10
        });

        const response = await docClient.send(command);
        const items = response.Items || [];

        // Sort by created_at desc (in-memory since scan is unordered)
        items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        console.log(`Found ${items.length} leads in ${TABLE_NAME} table.`);
        console.log('--- LATEST 5 LEADS ---');
        
        items.slice(0, 5).forEach((lead, index) => {
            console.log(`\n[${index + 1}] ID: ${lead.id || 'N/A'}`);
            console.log(`    Name: ${lead.name}`);
            console.log(`    Phone: ${lead.phone}`);
            console.log(`    Course: ${lead.course}`);
            console.log(`    Created At: ${lead.created_at}`);
            console.log(`    Source: ${lead.source_website || lead.meta_lead_id}`);
            if (lead.meta_lead_id) {
                console.log(`    Meta Lead ID: ${lead.meta_lead_id}`);
            }
        });

    } catch (error) {
        console.error('Error checking leads:', error.message);
    }
}

checkLatestLeads();
