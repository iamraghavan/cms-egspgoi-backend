const axios = require('axios');
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const dbConfig = require('../config/db');

// Initialize DynamoDB Client (if needed for user lookup, though service usually just handles external API)
// We might need it later, but for now let's focus on Smartflo API.

const SMARTFLO_BASE_URL = 'https://api-smartflo.tatateleservices.com/v1';

// In-memory token storage
let accessToken = null;
let tokenExpiry = null;

/**
 * Smartflo Service
 * Handles all interactions with Tata Smartflo API
 */
const smartfloService = {
  
  /**
   * Login to Smartflo to get Access Token
   */
  login: async () => {
    try {
      if (!process.env.SMARTFLO_EMAIL || !process.env.SMARTFLO_PASSWORD) {
        throw new Error('Smartflo credentials not configured in .env');
      }

      const response = await axios.post(`${SMARTFLO_BASE_URL}/auth/login`, {
        email: process.env.SMARTFLO_EMAIL,
        password: process.env.SMARTFLO_PASSWORD
      }, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      if (response.data && response.data.success) {
        accessToken = response.data.access_token;
        // Set expiry time (subtract 60s buffer)
        tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000;
        console.log('Smartflo Login Successful');
        return accessToken;
      } else {
        throw new Error('Smartflo Login Failed: ' + (response.data.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Smartflo Login Error:', error.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Get Valid Access Token (Login or Refresh if needed)
   */
  getToken: async () => {
    if (!accessToken || !tokenExpiry || Date.now() >= tokenExpiry) {
      // Token expired or not exists, login again
      // Note: Could implement refresh token flow, but login is simpler for server-side service 
      // unless we hit rate limits on login. Docs say "Short-Lived Token... 1-hour valid".
      // Refresh token is also an option. Let's stick to login for simplicity and robustness 
      // unless we have the refresh token stored. 
      // Actually, let's just re-login. It's safer than managing refresh token state across server restarts without DB.
      return await smartfloService.login();
    }
    return accessToken;
  },

  /**
   * Get Headers for API Requests
   */
  getHeaders: async () => {
    const token = await smartfloService.getToken();
    return {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  },

  /**
   * Initiate Click to Call
   * @param {string} agentNumber - Smartflo Agent ID/Number
   * @param {string} destinationNumber - Customer Number
   * @param {string} callerId - Caller ID (DID)
   */
  clickToCall: async (agentNumber, destinationNumber, callerId) => {
    try {
      const headers = await smartfloService.getHeaders();
      const payload = {
        agent_number: agentNumber,
        destination_number: destinationNumber,
        caller_id: callerId,
        async: 1, // Asynchronous
        call_timeout: 60 // Default timeout
      };

      const response = await axios.post(`${SMARTFLO_BASE_URL}/click_to_call`, payload, { headers });
      return response.data;
    } catch (error) {
      console.error('Click to Call Error:', error.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Fetch Live Calls
   * @param {Object} filters - Optional filters (agent_number, etc.)
   */
  getLiveCalls: async (filters = {}) => {
    try {
      const headers = await smartfloService.getHeaders();
      const response = await axios.get(`${SMARTFLO_BASE_URL}/live_calls`, { 
        headers,
        params: filters
      });
      return response.data;
    } catch (error) {
      console.error('Get Live Calls Error:', error.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Fetch Call Records (CDRs)
   * @param {Object} params - Query parameters (from_date, to_date, etc.)
   */
  getCallRecords: async (params = {}) => {
    try {
      const headers = await smartfloService.getHeaders();
      const response = await axios.get(`${SMARTFLO_BASE_URL}/call/records`, { 
        headers,
        params
      });
      return response.data;
    } catch (error) {
      console.error('Get Call Records Error:', error.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Call Operations (Monitor, Whisper, Barge, Transfer)
   * @param {number} type - 1: Monitor, 2: Whisper, 3: Barge, 4: Transfer
   * @param {string} callId - Unique ID of the call
   * @param {string} agentId - Agent ID (for Monitor/Whisper)
   * @param {string} intercom - Intercom/Number (for Transfer)
   */
  callOperation: async (type, callId, agentId = null, intercom = null) => {
    try {
      const headers = await smartfloService.getHeaders();
      const payload = {
        type,
        call_id: callId
      };
      if (agentId) payload.agent_id = agentId;
      if (intercom) payload.intercom = intercom;

      const response = await axios.post(`${SMARTFLO_BASE_URL}/call/options`, payload, { headers });
      return response.data;
    } catch (error) {
      console.error('Call Operation Error:', error.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Hangup Call
   * @param {string} callId 
   */
  hangupCall: async (callId) => {
    try {
      const headers = await smartfloService.getHeaders();
      const response = await axios.post(`${SMARTFLO_BASE_URL}/call/hangup`, { call_id: callId }, { headers });
      return response.data;
    } catch (error) {
      console.error('Hangup Call Error:', error.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Get Users (Agents)
   */
  getUsers: async () => {
    try {
      const headers = await smartfloService.getHeaders();
      const response = await axios.get(`${SMARTFLO_BASE_URL}/users`, { headers });
      return response.data;
    } catch (error) {
      console.error('Get Users Error:', error.response?.data || error.message);
      throw error;
    }
  }
};

module.exports = smartfloService;
