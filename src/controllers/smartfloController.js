const axios = require('axios');
const { docClient } = require('../config/db');
const { PutCommand } = require('@aws-sdk/lib-dynamodb');
const { sendSuccess, sendError } = require('../utils/responseUtils');

// Load environment variables
const SMARTFLO_BASE_URL = process.env.SMARTFLO_BASE_URL || 'https://api-smartflo.tatateleservices.com/v1';
const SMARTFLO_API_KEY = process.env.SMARTFLO_API_KEY; // Expected to be set in .env

/**
 * Hangup a call via Smartflo API.
 * Expects JSON body: { call_id: string }
 */
const hangupCall = async (req, res) => {
  try {
    const { call_id } = req.body;
    if (!call_id) {
      return sendError(res, { message: 'call_id is required' }, 'Hangup Call', 400);
    }

    const url = `${SMARTFLO_BASE_URL}/call/hangup`;
    const response = await axios.post(
      url,
      { call_id },
      {
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          Authorization: `Bearer ${SMARTFLO_API_KEY}`,
        },
      }
    );

    // Store the response in DynamoDB for audit purposes
    const item = {
      pk: `SMARTFLO#CALL#${call_id}`,
      sk: `METADATA#${new Date().toISOString()}`,
      call_id,
      response: response.data,
      created_at: new Date().toISOString(),
    };
    await docClient.send(new PutCommand({ TableName: process.env.DYNAMODB_TABLE, Item: item }));

    sendSuccess(res, response.data, 'Call hung up successfully');
  } catch (error) {
    const errMsg = error.response ? error.response.data : error.message;
    sendError(res, errMsg, 'Hangup Call');
  }
};

/**
 * Retrieve call detail records from Smartflo.
 * Accepts query parameters matching Smartflo API.
 */
const getCallRecords = async (req, res) => {
  try {
    const query = req.query; // forward all query params
    const url = `${SMARTFLO_BASE_URL}/call/records`;
    const response = await axios.get(url, {
      headers: {
        accept: 'application/json',
        Authorization: `Bearer ${SMARTFLO_API_KEY}`,
      },
      params: query,
    });

    // Optionally store the fetched records (batch) – here we just return them
    sendSuccess(res, response.data, 'Call records fetched');
  } catch (error) {
    const errMsg = error.response ? error.response.data : error.message;
    sendError(res, errMsg, 'Get Call Records');
  }
};

module.exports = { hangupCall, getCallRecords };
