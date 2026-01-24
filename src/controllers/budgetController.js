const { getISTTimestamp } = require('../utils/timeUtils');
const { v4: uuidv4 } = require('uuid');
const { docClient } = require('../config/db');
const { PutCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { BUDGET_TABLE_NAME, PROOF_TABLE_NAME } = require('../models/budgetModel');

const { sendSuccess, sendError } = require('../utils/responseUtils');
const { ScanCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");

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
      created_by: req.user.id,
      created_at: getISTTimestamp()
    };

    const command = new PutCommand({
      TableName: BUDGET_TABLE_NAME,
      Item: newBudget
    });

    await docClient.send(command);
    sendSuccess(res, newBudget, 'Budget request created', 201);
  } catch (error) {
    sendError(res, error, 'Create Budget');
  }
};

// Get Budgets (with Filters)
const getBudgets = async (req, res) => {
  try {
    const { campaign_id, status, created_by, startDate, endDate } = req.query;

    let filterExpression = [];
    let expressionAttributeValues = {};

    if (campaign_id) {
      filterExpression.push("campaign_id = :campaign_id");
      expressionAttributeValues[":campaign_id"] = campaign_id;
    }
    if (status) {
      filterExpression.push("status = :status");
      expressionAttributeValues[":status"] = status;
    }
    if (created_by) {
      filterExpression.push("created_by = :created_by");
      expressionAttributeValues[":created_by"] = created_by;
    }

    // Construct Scan Command
    const params = {
      TableName: BUDGET_TABLE_NAME
    };

    if (filterExpression.length > 0) {
      params.FilterExpression = filterExpression.join(" AND ");
      params.ExpressionAttributeValues = expressionAttributeValues;
    }

    const command = new ScanCommand(params);
    const result = await docClient.send(command);
    let items = result.Items || [];

    // Date Filter (In-Memory)
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate).getTime() : 0;
      const end = endDate ? new Date(endDate).getTime() : Date.now();

      items = items.filter(item => {
        const itemDate = new Date(item.created_at).getTime();
        return itemDate >= start && itemDate <= end;
      });
    }

    // Sort Descending
    items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    sendSuccess(res, items, 'Budgets fetched successfully');
  } catch (error) {
    sendError(res, error, 'Get Budgets');
  }
};

// Get Budget By ID
const getBudgetById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await docClient.send(new GetCommand({
      TableName: BUDGET_TABLE_NAME,
      Key: { id }
    }));

    if (!result.Item) {
      return sendError(res, { message: 'Budget not found' }, 'Get Budget', 404);
    }

    sendSuccess(res, result.Item, 'Budget fetched successfully');
  } catch (error) {
    sendError(res, error, 'Get Budget By ID');
  }
};

// Update Budget (Metadata/Amount)
const updateBudget = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, status, campaign_id } = req.body;

    // Check if exists
    const getResult = await docClient.send(new GetCommand({
      TableName: BUDGET_TABLE_NAME,
      Key: { id }
    }));

    if (!getResult.Item) {
      return sendError(res, { message: 'Budget not found' }, 'Update Budget', 404);
    }

    // Only 'pending' budgets should be editable by creator? Or Admin always.
    // Simplifying: Allow update.

    const command = new UpdateCommand({
      TableName: BUDGET_TABLE_NAME,
      Key: { id },
      UpdateExpression: "set amount = :a, campaign_id = :c, #status = :s, updated_at = :u",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":a": amount || getResult.Item.amount,
        ":c": campaign_id || getResult.Item.campaign_id,
        ":s": status || getResult.Item.status,
        ":u": getISTTimestamp()
      },
      ReturnValues: "ALL_NEW"
    });

    const result = await docClient.send(command);
    sendSuccess(res, result.Attributes, 'Budget updated successfully');
  } catch (error) {
    sendError(res, error, 'Update Budget');
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
      UpdateExpression: "set #status = :status, approved_by = :approved_by, updated_at = :u",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":status": status,
        ":approved_by": approved_by,
        ":u": getISTTimestamp()
      },
      ReturnValues: "ALL_NEW"
    });

    const result = await docClient.send(command);
    sendSuccess(res, result.Attributes, `Budget ${status}`);
  } catch (error) {
    sendError(res, error, 'Approve Budget');
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
    sendSuccess(res, newProof, 'Proof uploaded', 201);
  } catch (error) {
    sendError(res, error, 'Upload Proof');
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
      UpdateExpression: "set #status = :status, verified_by = :verified_by, updated_at = :u",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":status": status,
        ":verified_by": verified_by,
        ":u": getISTTimestamp()
      },
      ReturnValues: "ALL_NEW"
    });

    const result = await docClient.send(command);
    sendSuccess(res, result.Attributes, `Proof ${status}`);
  } catch (error) {
    sendError(res, error, 'Verify Proof');
  }
};

// Delete Budget request (Soft/Hard)
const deleteBudget = async (req, res) => {
  const { id } = req.params;
  const { type } = req.query; // hard or soft

  try {
    if (type === 'hard') {
      if (req.user.role !== 'Super Admin') {
        return sendError(res, { message: 'Only Super Admin can hard delete.' }, 'Delete Budget', 403);
      }
      const { DeleteCommand } = require("@aws-sdk/lib-dynamodb");
      await docClient.send(new DeleteCommand({
        TableName: BUDGET_TABLE_NAME,
        Key: { id }
      }));
      return sendSuccess(res, { id }, 'Budget permanently deleted');
    } else {
      const command = new UpdateCommand({
        TableName: BUDGET_TABLE_NAME,
        Key: { id },
        UpdateExpression: "set status = :status, updated_at = :u",
        ExpressionAttributeValues: {
          ":status": 'deleted',
          ":u": getISTTimestamp()
        }
      });
      await docClient.send(command);
      return sendSuccess(res, { id }, 'Budget soft deleted');
    }
  } catch (error) {
    sendError(res, error, 'Delete Budget');
  }
};

module.exports = {
  createBudget,
  getBudgets,
  getBudgetById,
  updateBudget,
  approveBudget,
  uploadProof,
  verifyProof,
  deleteBudget
};
