const { getISTTimestamp } = require('../utils/timeUtils');
const { v4: uuidv4 } = require('uuid');
const { docClient } = require('../config/db');
const { PutCommand, ScanCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { TABLE_NAME: ASSETS_TABLE } = require('../models/assetModel');

const uploadAsset = async (req, res) => {
  const { campaign_id, name, storage_url, file_type, version } = req.body;
  const uploaded_by = req.user.id;

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
    res.status(201).json(newAsset);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
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
    res.json(result.Items);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
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
    res.json(result.Attributes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { uploadAsset, getAssets, updateAssetStatus };
