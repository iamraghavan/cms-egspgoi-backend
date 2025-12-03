const { getISTTimestamp } = require('../utils/timeUtils');
const { v4: uuidv4 } = require('uuid');
const { docClient } = require('../config/db');
const { PutCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { BUDGET_TABLE_NAME, PROOF_TABLE_NAME } = require('../models/budgetModel');

/**
 * Creates a budget request.
 *
 * @param {Object} req - The request object.
 * @param {Object} req.body - The request body.
 * @param {string} req.body.campaign_id - The ID of the campaign.
 * @param {number} req.body.amount - The budget amount.
 * @param {Object} res - The response object.
 * @returns {void}
 */
const createBudget = async (req, res) => {
  const { campaign_id, amount } = req.body;

  try {
    const id = uuidv4();
    const newBudget = {
      id,
      campaign_id,
      amount,
      status: 'pending',
      created_at: getISTTimestamp()
    };

    const command = new PutCommand({
      TableName: BUDGET_TABLE_NAME,
      Item: newBudget
    });

    await docClient.send(command);
    res.status(201).json(newBudget);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Approves or rejects a budget (Finance).
 *
 * @param {Object} req - The request object.
 * @param {Object} req.params - The route parameters.
 * @param {string} req.params.id - The ID of the budget.
 * @param {Object} req.body - The request body.
 * @param {string} req.body.status - The new status (approved, rejected).
 * @param {Object} req.user - The authenticated user.
 * @param {string} req.user.id - The ID of the user approving the budget.
 * @param {Object} res - The response object.
 * @returns {void}
 */
const approveBudget = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // approved, rejected
  const approved_by = req.user.id;

  try {
    const command = new UpdateCommand({
      TableName: BUDGET_TABLE_NAME,
      Key: { id },
      UpdateExpression: "set #status = :status, approved_by = :approved_by",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":status": status,
        ":approved_by": approved_by
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

/**
 * Uploads a payment proof.
 *
 * @param {Object} req - The request object.
 * @param {Object} req.body - The request body.
 * @param {string} req.body.budget_id - The ID of the budget.
 * @param {string} req.body.transaction_ref - The transaction reference.
 * @param {string} req.body.proof_url - The URL of the proof.
 * @param {Object} req.user - The authenticated user.
 * @param {string} req.user.id - The ID of the user uploading the proof.
 * @param {Object} res - The response object.
 * @returns {void}
 */
const uploadProof = async (req, res) => {
  const { budget_id, transaction_ref, proof_url } = req.body;
  const uploaded_by = req.user.id;

  try {
    const id = uuidv4();
    const newProof = {
      id,
      budget_id,
      transaction_ref,
      proof_url,
      status: 'pending',
      uploaded_by,
      created_at: getISTTimestamp(),
      uploaded_at: getISTTimestamp()
    };

    const command = new PutCommand({
      TableName: PROOF_TABLE_NAME,
      Item: newProof
    });

    await docClient.send(command);
    res.status(201).json(newProof);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Verifies a payment proof (Finance).
 *
 * @param {Object} req - The request object.
 * @param {Object} req.params - The route parameters.
 * @param {string} req.params.id - The ID of the proof.
 * @param {Object} req.body - The request body.
 * @param {string} req.body.status - The new status (verified, rejected).
 * @param {Object} req.user - The authenticated user.
 * @param {string} req.user.id - The ID of the user verifying the proof.
 * @param {Object} res - The response object.
 * @returns {void}
 */
const verifyProof = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // verified, rejected
  const verified_by = req.user.id;

  try {
    const command = new UpdateCommand({
      TableName: PROOF_TABLE_NAME,
      Key: { id },
      UpdateExpression: "set #status = :status, verified_by = :verified_by",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":status": status,
        ":verified_by": verified_by
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

module.exports = { createBudget, approveBudget, uploadProof, verifyProof };
