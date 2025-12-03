const { getISTTimestamp } = require('../utils/timeUtils');
const { v4: uuidv4 } = require('uuid');
const { docClient } = require('../config/db');
const { PutCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { BUDGET_TABLE_NAME, PROOF_TABLE_NAME } = require('../models/budgetModel');

// Create a budget request
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

// Approve or Reject budget (Finance)
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

// Upload Payment Proof
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

// Verify Payment Proof (Finance)
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
