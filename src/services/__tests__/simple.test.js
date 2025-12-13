const { mockClient } = require('aws-sdk-client-mock');
const { DynamoDBDocumentClient, GetCommand, TransactWriteCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient } = require('../../config/db');
const assignmentService = require('../../services/assignmentService');
const { v4: uuidv4 } = require('uuid');
const { TABLE_NAME: LEADS_TABLE } = require('../../models/leadModel');
const { TABLE_NAME: USERS_TABLE } = require('../../models/userModel');
const logger = require('../../utils/logger');
const { getISTTimestamp, parseISTTimestamp } = require('../../utils/timeUtils');
const { generateLeadRef } = require('../../utils/idGenerator');
const leadService = require('../../services/leadService');

const ddbMock = mockClient(docClient);

describe('Simple Test', () => {
    it('should mock dynamoDB', async () => {
        ddbMock.on(GetCommand).resolves({ Item: { id: '1' } });
        const result = await docClient.send(new GetCommand({ TableName: 'Test', Key: { id: '1' } }));
        expect(result.Item.id).toBe('1');
    });

    it('should return a lead if it exists (using GSI)', async () => {
        ddbMock.on(QueryCommand).resolves({
            Items: [{ id: '123', phone: '9999999999' }]
        });

        const result = await leadService.findExistingLead('9999999999', '2024', 'web');
        expect(result).toBeDefined();
        expect(result.id).toBe('123');
    });

    it('should create a new lead successfully', async () => {
        try {
            // Mock findExistingLead (internal call, but we mock DB)
            ddbMock.on(QueryCommand).resolves({ Items: [] }); // No duplicate
            ddbMock.on(ScanCommand).resolves({ Items: [] }); // No agents
            ddbMock.on(TransactWriteCommand).resolves({});

            const leadData = {
                name: 'Test Lead',
                phone: '1234567890',
                admission_year: '2024',
                source_website: 'test'
            };

            const result = await leadService.createLeadInDB(leadData, false);
            
            expect(result.isDuplicate).toBe(false);
            expect(result.lead).toBeDefined();
            expect(result.lead.id).toBeDefined();
            expect(result.lead.status).toBe('new');
        } catch (error) {
            console.error('Test Failed:', error);
            throw error;
        }
    });

    it('should detect duplicates for external leads', async () => {
         ddbMock.on(QueryCommand).resolves({
            Items: [{ id: 'existing-id', phone: '1234567890' }]
        });

        const leadData = {
            name: 'Test Lead',
            phone: '1234567890',
            admission_year: '2024',
            source_website: 'test'
        };

        const result = await leadService.createLeadInDB(leadData, false);
        
        expect(result.isDuplicate).toBe(true);
        expect(result.lead.id).toBe('existing-id');
    });
});
