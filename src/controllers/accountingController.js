const { getISTTimestamp, parseISTTimestamp } = require('../utils/timeUtils');
const { v4: uuidv4 } = require('uuid');
const { docClient } = require('../config/db');
const { PutCommand, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { TABLE_NAME: PAYMENT_TABLE, schema: paymentSchema } = require('../models/paymentRecordModel');
const { TABLE_NAME: AD_SPEND_TABLE, schema: adSpendSchema } = require('../models/adSpendModel');

// --- Payment Records ---

const createPaymentRecord = async (req, res) => {
  const { date, transfer_by, payment_id, payment_method, amount, from_account, transaction_id, purpose, remarks } = req.body;
  const created_by = req.user.id;

  try {
    const id = uuidv4();
    const newRecord = {
      id,
      date,
      transfer_by,
      payment_id,
      payment_method,
      amount,
      from_account,
      transaction_id,
      purpose,
      remarks,
      created_by,
      created_at: getISTTimestamp()
    };

    const { error } = paymentSchema.validate(newRecord);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const command = new PutCommand({
      TableName: PAYMENT_TABLE,
      Item: newRecord
    });

    await docClient.send(command);
    res.status(201).json(newRecord);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getPaymentRecords = async (req, res) => {
  try {
    const command = new ScanCommand({ TableName: PAYMENT_TABLE });
    const result = await docClient.send(command);
    // Sort by date desc
    const records = result.Items.sort((a, b) => parseISTTimestamp(b.date) - parseISTTimestamp(a.date));
    res.json(records);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Ad Spends ---

const createAdSpend = async (req, res) => {
  const { date, platform, budget_allocated, actual_spend, invoice_no, invoice_url, remarks, campaign_id } = req.body;
  const created_by = req.user.id;

  try {
    const id = uuidv4();
    const newSpend = {
      id,
      date,
      platform,
      budget_allocated,
      actual_spend,
      invoice_no,
      invoice_url,
      remarks,
      campaign_id,
      created_by,
      created_at: getISTTimestamp()
    };

    const { error } = adSpendSchema.validate(newSpend);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const command = new PutCommand({
      TableName: AD_SPEND_TABLE,
      Item: newSpend
    });

    await docClient.send(command);
    res.status(201).json(newSpend);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getAdSpends = async (req, res) => {
  try {
    const command = new ScanCommand({ TableName: AD_SPEND_TABLE });
    const result = await docClient.send(command);
    // Sort by date desc
    const spends = result.Items.sort((a, b) => parseISTTimestamp(b.date) - parseISTTimestamp(a.date));
    res.json(spends);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createPaymentRecord,
  getPaymentRecords,
  createAdSpend,
  getAdSpends
};
