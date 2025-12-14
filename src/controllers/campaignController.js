const { getISTTimestamp, parseISTTimestamp } = require('../utils/timeUtils');
const { docClient } = require('../config/db');
const { PutCommand, ScanCommand, UpdateCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { TABLE_NAME: CAMPAIGNS_TABLE, schema: campaignSchema } = require('../models/campaignModel');
const { v4: uuidv4 } = require('uuid');
const { sendSuccess, sendError } = require('../utils/responseUtils');

// 1. Create Campaign
const createCampaign = async (req, res) => {
  try {
    const { 
      name, description, type, platform, start_date, end_date, 
      target_audience, settings, institution, objective, kpi, detailed_plan 
    } = req.body;

    // Validate Input
    // Note: We might need to construct a robust object for validation if body has extra fields
    const { error } = campaignSchema.validate({
        ...req.body,
        id: uuidv4(), // Dummy ID for validation if schema requires UUID
        created_by: req.user.id
    }, { allowUnknown: true, abortEarly: false }); 
    // Schema might require exact fields, but let's be flexible or严格 based on model.
    // The model schema requires 'id' and 'created_by'.
    
    // Better approach: Prepare the object first
    const id = uuidv4();
    const created_by = req.user.id;
    const timestamp = getISTTimestamp();

    const newCampaign = {
      id,
      name,
      description,
      type,
      platform,
      status: 'draft',
      start_date,
      end_date,
      target_audience: target_audience || {},
      settings: settings || {},
      institution,
      objective,
      kpi,
      detailed_plan: detailed_plan || {},
      created_by,
      is_deleted: false,
      created_at: timestamp,
      updated_at: timestamp
    };

    const { error: validationError } = campaignSchema.validate(newCampaign);
    if (validationError) {
        return sendError(res, validationError, 'Validation', 400);
    }

    const command = new PutCommand({
      TableName: CAMPAIGNS_TABLE,
      Item: newCampaign
    });

    await docClient.send(command);
    sendSuccess(res, newCampaign, 'Campaign created successfully', 201);
  } catch (error) {
    sendError(res, error, 'Create Campaign');
  }
};

// 2. Get All Campaigns
const getCampaigns = async (req, res) => {
  try {
    // TODO: Implement Pagination & Filtering
    const command = new ScanCommand({
      TableName: CAMPAIGNS_TABLE,
      FilterExpression: "is_deleted = :false",
      ExpressionAttributeValues: { ":false": false }
    });
    
    const result = await docClient.send(command);
    // Sort in memory (newest first)
    const campaigns = (result.Items || []).sort((a, b) => parseISTTimestamp(b.created_at) - parseISTTimestamp(a.created_at));
    
    sendSuccess(res, campaigns, 'Campaigns fetched successfully');
  } catch (error) {
    sendError(res, error, 'Get Campaigns');
  }
};

// 3. Get Campaign By ID
const getCampaignById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await docClient.send(new GetCommand({
            TableName: CAMPAIGNS_TABLE,
            Key: { id }
        }));
        
        if (!result.Item || result.Item.is_deleted) {
            return sendError(res, { message: 'Campaign not found' }, 'Get Campaign', 404);
        }

        sendSuccess(res, result.Item, 'Campaign fetched successfully');
    } catch (error) {
        sendError(res, error, 'Get Campaign By ID');
    }
};

// 4. Update Campaign
const updateCampaign = async (req, res) => {
    try {
        const { id } = req.params;
        // Fetch existing first to merge/validate
        const getResult = await docClient.send(new GetCommand({
            TableName: CAMPAIGNS_TABLE,
            Key: { id }
        }));

        if (!getResult.Item || getResult.Item.is_deleted) {
            return sendError(res, { message: 'Campaign not found' }, 'Update Campaign', 404);
        }
        
        const existingCampaign = getResult.Item;
        const updatedFields = req.body;
        
        // Prevent immutable field updates if necessary (like id, created_by)
        delete updatedFields.id;
        delete updatedFields.created_by;
        delete updatedFields.created_at;

        const updatedCampaign = {
            ...existingCampaign,
            ...updatedFields,
            updated_at: getISTTimestamp()
        };

        // Validate Merged Object
        const { error } = campaignSchema.validate(updatedCampaign);
        if (error) return sendError(res, error, 'Validation', 400);

        await docClient.send(new PutCommand({
            TableName: CAMPAIGNS_TABLE,
            Item: updatedCampaign
        }));

        sendSuccess(res, updatedCampaign, 'Campaign updated successfully');
    } catch (error) {
        sendError(res, error, 'Update Campaign');
    }
};

// 5. Update Status (Patch)
const updateCampaignStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['draft', 'scheduled', 'active', 'completed', 'paused'];
  if (!validStatuses.includes(status)) {
      return sendError(res, { message: `Invalid status. Allowed: ${validStatuses.join(', ')}` }, 'Update Status', 400);
  }

  try {
    const command = new UpdateCommand({
      TableName: CAMPAIGNS_TABLE,
      Key: { id },
      UpdateExpression: "set #status = :status, updated_at = :updated_at",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":status": status,
        ":updated_at": getISTTimestamp()
      },
      ReturnValues: "ALL_NEW"
    });

    const result = await docClient.send(command);
    sendSuccess(res, result.Attributes, 'Campaign status updated successfully');
  } catch (error) {
    sendError(res, error, 'Update Campaign Status');
  }
};

// 6. Delete Campaign (Soft)
const deleteCampaign = async (req, res) => {
    try {
        const { id } = req.params;
        // Check existence
        const getResult = await docClient.send(new GetCommand({
            TableName: CAMPAIGNS_TABLE,
            Key: { id }
        }));

        if (!getResult.Item) {
            return sendError(res, { message: 'Campaign not found' }, 'Delete Campaign', 404);
        }

        const command = new UpdateCommand({
            TableName: CAMPAIGNS_TABLE,
            Key: { id },
            UpdateExpression: "set is_deleted = :true, deleted_at = :now",
            ExpressionAttributeValues: {
                ":true": true,
                ":now": getISTTimestamp()
            }
        });

        await docClient.send(command);
        sendSuccess(res, { id }, 'Campaign deleted successfully');
    } catch (error) {
        sendError(res, error, 'Delete Campaign');
    }
};

module.exports = { 
    createCampaign, 
    getCampaigns, 
    getCampaignById, 
    updateCampaign, 
    updateCampaignStatus, 
    deleteCampaign 
};
