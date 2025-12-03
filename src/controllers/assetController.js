const { getISTTimestamp } = require('../utils/timeUtils');
const { v4: uuidv4 } = require('uuid');
const { docClient } = require('../config/db');
const { PutCommand, ScanCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { TABLE_NAME: ASSETS_TABLE } = require('../models/assetModel');

/**
 * Uploads a new asset.
 *
 * @param {Object} req - The request object.
 * @param {Object} req.body - The request body.
 * @param {string} req.body.campaign_id - The ID of the campaign.
 * @param {string} req.body.name - The name of the asset.
 * @param {string} req.body.storage_url - The URL where the asset is stored.
 * @param {string} req.body.file_type - The type of the file.
 * @param {number} [req.body.version] - The version of the asset.
 * @param {Object} req.user - The authenticated user.
 * @param {string} req.user.id - The ID of the user uploading the asset.
 * @param {Object} res - The response object.
 * @returns {void}
 */
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

/**
 * Retrieves assets based on filters.
 *
 * @param {Object} req - The request object.
 * @param {Object} req.query - The query parameters.
 * @param {string} [req.query.campaign_id] - Filter by campaign ID.
 * @param {string} [req.query.my_assets] - Filter by assets uploaded by the current user.
 * @param {Object} req.user - The authenticated user.
 * @param {string} req.user.id - The ID of the current user.
 * @param {Object} res - The response object.
 * @returns {void}
 */
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

/**
 * Updates the status of an asset.
 *
 * @param {Object} req - The request object.
 * @param {Object} req.params - The route parameters.
 * @param {string} req.params.id - The ID of the asset.
 * @param {Object} req.body - The request body.
 * @param {string} req.body.status - The new status (e.g., 'review', 'approved').
 * @param {Object} res - The response object.
 * @returns {void}
 */
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
