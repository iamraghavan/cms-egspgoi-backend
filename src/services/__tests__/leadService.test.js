const { mockClient } = require('aws-sdk-client-mock');
const { PutCommand, ScanCommand, QueryCommand, GetCommand, TransactWriteCommand } = require("@aws-sdk/lib-dynamodb");
const leadService = require('../services/leadService');
const { docClient } = require('../config/db');

const ddbMock = mockClient(docClient);

describe('Lead Service', () => {
    beforeEach(() => {
        ddbMock.reset();
    });

    describe('findExistingLead', () => {
        it('should return a lead if it exists (using GSI)', async () => {
            ddbMock.on(QueryCommand).resolves({
                Items: [{ id: '123', phone: '9999999999' }]
            });

            const result = await leadService.findExistingLead('9999999999', '2024', 'web');
            expect(result).toBeDefined();
            expect(result.id).toBe('123');
        });

        it('should return undefined if no lead exists', async () => {
            ddbMock.on(QueryCommand).resolves({
                Items: []
            });

            const result = await leadService.findExistingLead('9999999999', '2024', 'web');
            expect(result).toBeUndefined();
        });
    });

    describe('createLeadInDB', () => {
        it('should create a new lead successfully', async () => {
            // Mock findExistingLead (internal call, but we mock DB)
            ddbMock.on(QueryCommand).resolves({ Items: [] }); // No duplicate
            ddbMock.on(ScanCommand).resolves({ Items: [] }); // No agents (for simplicity)
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
});
