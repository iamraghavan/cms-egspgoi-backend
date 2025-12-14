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

module.exports = { uploadAsset, getAssets, updateAssetStatus };
