const { getISTTimestamp, parseISTTimestamp } = require('../utils/timeUtils');
const { docClient } = require('../config/db');
const { PutCommand, ScanCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { TABLE_NAME: CAMPAIGNS_TABLE } = require('../models/campaignModel');
const { v4: uuidv4 } = require('uuid');

/**
 * Creates a new campaign.
 *
 * @param {Object} req - The request object.
 * @param {Object} req.body - The body of the request.
 * @param {string} req.body.name - The name of the campaign.
 * @param {string} [req.body.description] - The description of the campaign.
 * @param {string} req.body.type - The type of campaign.
 * @param {string} req.body.platform - The platform for the campaign.
 * @param {string} req.body.start_date - The start date of the campaign.
 * @param {string} req.body.end_date - The end date of the campaign.
 * @param {Object} [req.body.target_audience] - Target audience details.
 * @param {Object} [req.body.settings] - Campaign settings.
 * @param {string} req.body.institution - The institution name.
 * @param {string} req.body.objective - The objective of the campaign.
 * @param {string} req.body.kpi - The KPI for the campaign.
 * @param {Object} [req.body.detailed_plan] - The detailed plan.
 * @param {Object} req.user - The authenticated user.
 * @param {string} req.user.id - The ID of the user creating the campaign.
 * @param {Object} res - The response object.
 * @returns {void}
 */
const createCampaign = async (req, res) => {
  const { name, description, type, platform, start_date, end_date, target_audience, settings, institution, objective, kpi, detailed_plan } = req.body;
  const created_by = req.user.id;

  try {
    const id = uuidv4();
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
      created_at: getISTTimestamp(),
      updated_at: getISTTimestamp()
    };

    const command = new PutCommand({
      TableName: CAMPAIGNS_TABLE,
      Item: newCampaign
    });

    await docClient.send(command);
    res.status(201).json(newCampaign);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Retrieves all campaigns.
 *
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @returns {void}
 */
const getCampaigns = async (req, res) => {
  try {
    const command = new ScanCommand({
      TableName: CAMPAIGNS_TABLE
    });
    const result = await docClient.send(command);
    // Sort in memory as Scan doesn't guarantee order
    const campaigns = result.Items.sort((a, b) => parseISTTimestamp(b.created_at) - parseISTTimestamp(a.created_at));
    res.json(campaigns);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Updates the status of a campaign.
 *
 * @param {Object} req - The request object.
 * @param {Object} req.params - The route parameters.
 * @param {string} req.params.id - The ID of the campaign to update.
 * @param {Object} req.body - The request body.
 * @param {string} req.body.status - The new status.
 * @param {Object} res - The response object.
 * @returns {void}
 */
const updateCampaignStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

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
    res.json(result.Attributes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { createCampaign, getCampaigns, updateCampaignStatus };
