const { docClient } = require('../src/config/db');
const { ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { TABLE_NAME } = require('../src/models/leadModel');

async function findDummyData() {
    console.log(`Scanning table: ${TABLE_NAME}...`);
    try {
        const res = await docClient.send(new ScanCommand({ TableName: TABLE_NAME }));
        const leads = res.Items || [];

        const dummyLeads = leads.filter(item => {
            // Check for 'test' in name, email, district, or college
            const name = (item.name || '').toLowerCase();
            const email = (item.email || '').toLowerCase();
            const college = (item.college || '').toLowerCase();
            const source = (item.source_website || '').toLowerCase();
            
            return name.includes('test') || 
                   email.includes('test') || 
                   college.includes('test') || 
                   source.includes('test') ||
                   name.includes('dummy'); // Also check for dummy
        });

        console.log(`Total Leads found: ${leads.length}`);
        console.log(`Dummy Leads found: ${dummyLeads.length}`);
        console.log('\n--- TARGETS FOR DELETION ---');
        dummyLeads.forEach(lead => {
            console.log(`ID: ${lead.id} | Name: ${lead.name} | Phone: ${lead.phone} | Source: ${lead.source_website}`);
        });

        return dummyLeads;
    } catch (err) {
        console.error('Error scanning leads:', err);
    }
}

findDummyData();
