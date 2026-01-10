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



/**
 * Get Active Call for a Lead
 * @desc Backend polling: Checks if the logged-in agent has a live call with this Lead.
 */
const getActiveCall = async (req, res) => {
  try {
    const { lead_id } = req.params;
    // Allow fallback: If not in Token (req.user), check Query Params (for testing/admins)
    const agent_number = req.user.agent_number || req.query.agent_number;

    if (!agent_number) {
      return sendError(res, { message: 'Agent number not found in profile or query params.' }, 'Get Active Call', 400);
    }

    const leadService = require('../services/leadService');
    const lead = await leadService.getLeadById(lead_id);

    if (!lead) {
      return sendError(res, { message: 'Lead not found' }, 'Get Active Call', 404);
    }

    const liveCalls = await smartfloService.getLiveCalls({ agent_number });

    const getLast10 = (num) => num ? num.toString().replace(/\D/g, '').slice(-10) : '';
    const targetPhone = getLast10(lead.phone);

    let activeCall = null;

    if (Array.isArray(liveCalls)) {
      activeCall = liveCalls.find(call => {
        const callCustomer = getLast10(call.customer_number || call.destination_number || call.destination);
        return callCustomer === targetPhone;
      });
    }

    if (activeCall) {
      return sendSuccess(res, {
        active: true,
        call_id: activeCall.call_id,
        status: activeCall.call_status || activeCall.state,
        duration: activeCall.duration || activeCall.call_time
      }, 'Active call found');
    } else {
      return sendSuccess(res, { active: false }, 'No active call found');
    }

  } catch (error) {
    sendError(res, error, 'Get Active Call');
  }
};

module.exports = {
  clickToCall,
  getLiveCalls,
  getCallRecords,
  callOperation,
  hangupCall,
  getSmartfloUsers,
  getActiveCall
};
