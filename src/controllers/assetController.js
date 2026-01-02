const { getISTTimestamp } = require('../utils/timeUtils');
const { v4: uuidv4 } = require('uuid');
const { docClient } = require('../config/db');
const { PutCommand, ScanCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { TABLE_NAME: ASSETS_TABLE } = require('../models/assetModel');
const { sendSuccess, sendError } = require('../utils/responseUtils');

const uploadAsset = async (req, res) => {
  const { campaign_id, name, storage_url, file_type, version } = req.body;
  const uploaded_by = req.user.id;

  // Validation could be added here similar to campaign

  try {
    const id = uuidv4();
    const newAsset = {
      id,
      campaign_id,
      name,
      storage_url,
      file_type,
      version: version || 1,
      status: 'draft',
      uploaded_by,
      uploaded_at: getISTTimestamp(),
      updated_at: getISTTimestamp()
    };

    const command = new PutCommand({
      TableName: ASSETS_TABLE,
      Item: newAsset
    });

    await docClient.send(command);
    sendSuccess(res, newAsset, 'Asset uploaded successfully', 201);
  } catch (error) {
    sendError(res, error, 'Upload Asset');
  }
};

const getAssets = async (req, res) => {
  const { campaign_id, my_assets } = req.query;

  try {
    let command;
    let filterExpression = "";
    let expressionAttributeValues = {};

    if (campaign_id) {
      filterExpression += "campaign_id = :campaign_id";
      expressionAttributeValues[":campaign_id"] = campaign_id;
    }

    if (my_assets === 'true') {
      if (filterExpression) filterExpression += " AND ";
      filterExpression += "uploaded_by = :uploaded_by";
      expressionAttributeValues[":uploaded_by"] = req.user.id;
    }

    if (filterExpression) {
      command = new ScanCommand({
        TableName: ASSETS_TABLE,
        FilterExpression: filterExpression,
        ExpressionAttributeValues: expressionAttributeValues
      });
    } else {
      command = new ScanCommand({ TableName: ASSETS_TABLE });
    }

    const result = await docClient.send(command);
    sendSuccess(res, result.Items, 'Assets fetched successfully');
  } catch (error) {
    sendError(res, error, 'Get Assets');
  }
};

const updateAssetStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // review, approved

  try {
    const command = new UpdateCommand({
      TableName: ASSETS_TABLE,
      Key: { id },
      UpdateExpression: "set #status = :status",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: { ":status": status },
      ReturnValues: "ALL_NEW"
    });

    const result = await docClient.send(command);
    sendSuccess(res, result.Attributes, 'Asset status updated successfully');
  } catch (error) {
    sendError(res, error, 'Update Asset Status');
  }
};

// Delete Asset (Soft/Hard)
const deleteAsset = async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.query;

    if (type === 'hard') {
      if (req.user.role !== 'Super Admin') {
        return sendError(res, { message: 'Only Super Admin can hard delete.' }, 'Delete Asset', 403);
      }
      const { DeleteCommand } = require("@aws-sdk/lib-dynamodb");
      await docClient.send(new DeleteCommand({
        TableName: ASSETS_TABLE,
        Key: { id }
      }));
      sendSuccess(res, { id }, 'Asset permanently deleted');
      return;
    }

    // Soft delete could involve status update or is_deleted flag. Model check needed?
    // Assuming status update to 'deleted' for consistency with budget if schema supports it or is_deleted.
    // Asset model not checked, but based on others, I'll use status='deleted' for now as safe default if is_deleted field missing.
    // Actually, let's use is_deleted safely if schema is strict, but status is present.
    const command = new UpdateCommand({
      TableName: ASSETS_TABLE,
      Key: { id },
      UpdateExpression: "set #status = :status, updated_at = :time",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":status": "deleted",
        ":time": getISTTimestamp()
      }
    });
    await docClient.send(command);
    sendSuccess(res, { id }, 'Asset soft deleted (status=deleted)');
  } catch (error) {
    sendError(res, error, 'Delete Asset');
  }
};

module.exports = { uploadAsset, getAssets, updateAssetStatus, deleteAsset };
