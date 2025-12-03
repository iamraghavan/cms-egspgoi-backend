const { getISTTimestamp, parseISTTimestamp } = require('../utils/timeUtils');
const { v4: uuidv4 } = require('uuid');
const { docClient } = require('../config/db');
const { PutCommand, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { TABLE_NAME: PAYMENT_TABLE, schema: paymentSchema } = require('../models/paymentRecordModel');
const { TABLE_NAME: AD_SPEND_TABLE, schema: adSpendSchema } = require('../models/adSpendModel');

// --- Payment Records ---

/**
 * Creates a new payment record.
 *
 * @param {Object} req - The request object.
 * @param {Object} req.body - The request body.
 * @param {string} req.body.date - The date of the payment.
 * @param {string} req.body.transfer_by - The name of the person transferring.
 * @param {string} req.body.payment_id - The payment ID.
 * @param {string} req.body.payment_method - The payment method.
 * @param {number} req.body.amount - The amount paid.
 * @param {string} req.body.from_account - The account paid from.
 * @param {string} req.body.transaction_id - The transaction ID.
 * @param {string} req.body.purpose - The purpose of the payment.
 * @param {string} req.body.remarks - Any remarks.
 * @param {Object} req.user - The authenticated user.
 * @param {string} req.user.id - The ID of the user creating the record.
 * @param {Object} res - The response object.
 * @returns {void}
 */
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

/**
 * Retrieves all payment records.
 *
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @returns {void}
 */
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

/**
 * Creates a new ad spend record.
 *
 * @param {Object} req - The request object.
 * @param {Object} req.body - The request body.
 * @param {string} req.body.date - The date of the ad spend.
 * @param {string} req.body.platform - The platform (e.g., Google, Facebook).
 * @param {number} req.body.budget_allocated - The allocated budget.
 * @param {number} req.body.actual_spend - The actual spend.
 * @param {string} req.body.invoice_no - The invoice number.
 * @param {string} req.body.invoice_url - The invoice URL.
 * @param {string} req.body.remarks - Any remarks.
 * @param {string} req.body.campaign_id - The associated campaign ID.
 * @param {Object} req.user - The authenticated user.
 * @param {string} req.user.id - The ID of the user creating the record.
 * @param {Object} res - The response object.
 * @returns {void}
 */
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

/**
 * Retrieves all ad spend records.
 *
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @returns {void}
 */
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
