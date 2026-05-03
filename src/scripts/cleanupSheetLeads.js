const { docClient } = require('../config/db');
const { ScanCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { TABLE_NAME } = require('../models/leadModel');
const logger = require('../utils/logger');

/**
 * Script to cleanup dummy "Sheet Lead" records from DynamoDB.
 */
async function cleanupSheetLeads() {
    logger.info(`Starting cleanup of "Sheet Lead" records from ${TABLE_NAME}...`);
    
    let scannedCount = 0;
    let deletedCount = 0;
    let exclusiveStartKey = null;

    try {
        do {
            const params = {
                TableName: TABLE_NAME,
                FilterExpression: '#name = :nameVal OR source_website = :sourceVal',
                ExpressionAttributeNames: {
                    '#name': 'name'
                },
                ExpressionAttributeValues: {
                    ':nameVal': 'Sheet Lead',
                    ':sourceVal': 'google_sheets' // Also check if it's from sheets but has dummy data
                }
            };

            if (exclusiveStartKey) {
                params.ExclusiveStartKey = exclusiveStartKey;
            }

            const scanCommand = new ScanCommand(params);
            const response = await docClient.send(scanCommand);
            
            scannedCount += response.ScannedCount;
            
            if (response.Items && response.Items.length > 0) {
                for (const item of response.Items) {
                    // Double check before delete: If it's "Sheet Lead" OR it has no phone/email and is from sheets
                    const isDummyName = item.name === 'Sheet Lead';
                    const isLikelyEmpty = !item.phone && !item.email && item.source_website === 'google_sheets';

                    if (isDummyName || isLikelyEmpty) {
                        logger.info(`Deleting dummy lead: ID=${item.id}, Name=${item.name}, Phone=${item.phone}`);
                        
                        await docClient.send(new DeleteCommand({
                            TableName: TABLE_NAME,
                            Key: { id: item.id }
                        }));
                        deletedCount++;
                    }
                }
            }

            exclusiveStartKey = response.LastEvaluatedKey;
            logger.info(`Progress: Scanned ${scannedCount} items, Deleted ${deletedCount} dummies...`);

        } while (exclusiveStartKey);

        logger.info(`Cleanup complete! Total items scanned: ${scannedCount}, Total items deleted: ${deletedCount}`);
    } catch (error) {
        logger.error('Error during cleanup:', error);
    }
}

// Run if called directly
if (require.main === module) {
    cleanupSheetLeads()
        .then(() => process.exit(0))
        .catch(err => {
            console.error(err);
            process.exit(1);
        });
}

module.exports = cleanupSheetLeads;
