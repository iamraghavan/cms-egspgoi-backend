const { docClient } = require('../src/config/db');
const { ScanCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { TABLE_NAME } = require('../src/models/leadModel');

async function deleteDummyLeads() {
    console.log(`Scanning table for dummy data: ${TABLE_NAME}...`);
    try {
        const res = await docClient.send(new ScanCommand({ TableName: TABLE_NAME }));
        const leads = res.Items || [];

        const dummyLeads = leads.filter(item => {
            const name = (item.name || '').toLowerCase();
            const email = (item.email || '').toLowerCase();
            const college = (item.college || '').toLowerCase();
            const source = (item.source_website || '').toLowerCase();
            
            return name.includes('test') || 
                   email.includes('test') || 
                   college.includes('test') || 
                   source.includes('test') ||
                   name.includes('dummy');
        });

        if (dummyLeads.length === 0) {
            console.log('No dummy leads found to delete.');
            return;
        }

        console.log(`Found ${dummyLeads.length} dummy leads. Starting permanent deletion...`);

        for (const lead of dummyLeads) {
            try {
                await docClient.send(new DeleteCommand({
                    TableName: TABLE_NAME,
                    Key: { id: lead.id }
                }));
                console.log(`DELETED: ${lead.id} (${lead.name})`);
            } catch (delErr) {
                console.error(`Failed to delete lead ${lead.id}:`, delErr.message);
            }
        }

        console.log('\n--- DELETION COMPLETED ---');
    } catch (err) {
        console.error('Error during cleanup:', err);
    }
}

deleteDummyLeads();
