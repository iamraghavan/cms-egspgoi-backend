const { getISTTimestamp, parseISTTimestamp } = require('../utils/timeUtils');
const { docClient } = require('../config/db');
const { PutCommand, ScanCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { TABLE_NAME: CAMPAIGNS_TABLE } = require('../models/campaignModel');

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
