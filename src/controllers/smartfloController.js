const smartfloService = require('../services/smartfloService');
const { sendSuccess, sendError } = require('../utils/responseUtils');
const logger = require('../utils/logger'); // Assuming logger exists

/**
 * Initiate Click to Call
 */
const clickToCall = async (req, res) => {
  try {
    const { agent_number, destination_number } = req.body;
    // Caller ID might be optional or from env
    const response = await smartfloService.clickToCall(agent_number, destination_number);
    sendSuccess(res, response, 'Call initiated successfully');
  } catch (error) {
    sendError(res, error, 'Click to Call');
  }
};

/**
 * Get Live Calls
 */
const getLiveCalls = async (req, res) => {
  try {
    const filters = req.query;
    const response = await smartfloService.getLiveCalls(filters);
    sendSuccess(res, response, 'Live calls fetched');
  } catch (error) {
    sendError(res, error, 'Get Live Calls');
  }
};

/**
 * Get Call Records
 */
const getCallRecords = async (req, res) => {
  try {
    const params = req.query;
    const response = await smartfloService.getCallRecords(params);
    sendSuccess(res, response, 'Call records fetched');
  } catch (error) {
    sendError(res, error, 'Get Call Records');
  }
};

/**
 * Call Operations (Monitor, Whisper, Barge, Transfer)
 */
const callOperation = async (req, res) => {
  try {
    const { type, call_id, agent_id, intercom } = req.body;
    if (!type || !call_id) {
      return sendError(res, { message: 'Type and Call ID are required' }, 'Call Operation', 400);
    }
    const response = await smartfloService.callOperation(type, call_id, agent_id, intercom);
    sendSuccess(res, response, 'Call operation executed');
  } catch (error) {
    sendError(res, error, 'Call Operation');
  }
};

/**
 * Hangup Call
 */
const hangupCall = async (req, res) => {
  try {
    const { call_id } = req.body;
    if (!call_id) {
      return sendError(res, { message: 'call_id is required' }, 'Hangup Call', 400);
    }
    const response = await smartfloService.hangupCall(call_id);
    sendSuccess(res, response, 'Call hung up successfully');
  } catch (error) {
    sendError(res, error, 'Hangup Call');
  }
};

/**
 * Get Smartflo Users
 */
const getSmartfloUsers = async (req, res) => {
  try {
    const response = await smartfloService.getUsers();
    sendSuccess(res, response, 'Smartflo users fetched');
  } catch (error) {
    sendError(res, error, 'Get Smartflo Users');
  }
};

module.exports = {
  clickToCall,
  getLiveCalls,
  getCallRecords,
  callOperation,
  hangupCall,
  getSmartfloUsers
};
