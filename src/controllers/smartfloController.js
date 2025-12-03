const smartfloService = require('../services/smartfloService');
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand } = require("@aws-sdk/lib-dynamodb");
const dbConfig = require('../config/db');
const logger = require('../utils/logger');
const Joi = require('joi');

const client = new DynamoDBClient(dbConfig);
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_USERS = "Users"; 

const smartfloController = {

  // --- Call Operations ---

  clickToCall: async (req, res, next) => {
    // Validation Schema
    const schema = Joi.object({
        destination_number: Joi.string().pattern(/^[0-9]+$/).min(10).required(),
        caller_id: Joi.string().optional().allow('')
    });

    const { error } = schema.validate(req.body);
    if (error) {
        logger.warn(`ClickToCall Validation Error: ${error.details[0].message}`);
        return res.status(400).json({ error: error.details[0].message });
    }

    try {
      const { destination_number } = req.body;
      const userId = req.user.id; 

      // Fetch user to get their Smartflo Agent ID
      const userResult = await docClient.send(new GetCommand({
        TableName: TABLE_USERS,
        Key: { id: userId }
      }));

      const user = userResult.Item;
      if (!user || !user.smartflo_agent_id) {
        logger.warn(`User ${userId} attempted ClickToCall without Smartflo Agent ID`);
        return res.status(400).json({ error: 'User does not have a linked Smartflo Agent ID' });
      }

      const callerId = req.body.caller_id || ""; 

      logger.info(`User ${userId} initiating ClickToCall to ${destination_number}`);
      const result = await smartfloService.clickToCall(user.smartflo_agent_id, destination_number, callerId);
      res.json(result);
    } catch (error) {
      logger.error('ClickToCall Error:', error);
      next(error);
    }
  },

  getLiveCalls: async (req, res, next) => {
    try {
      const filters = req.query;
      // TODO: Implement stricter RBAC data scoping here if needed
      
      const result = await smartfloService.getLiveCalls(filters);
      res.json(result);
    } catch (error) {
      logger.error('GetLiveCalls Error:', error);
      next(error);
    }
  },

  getCallRecords: async (req, res, next) => {
    try {
      const params = req.query;
      const result = await smartfloService.getCallRecords(params);
      res.json(result);
    } catch (error) {
      logger.error('GetCallRecords Error:', error);
      next(error);
    }
  },

  callOperation: async (req, res, next) => {
    const schema = Joi.object({
        type: Joi.number().valid(1, 2, 3, 4).required(), // 1: Monitor, 2: Whisper, 3: Barge, 4: Transfer
        call_id: Joi.string().required(),
        agent_id: Joi.string().optional(),
        intercom: Joi.string().optional()
    });

    const { error } = schema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    try {
      const { type, call_id, agent_id, intercom } = req.body;
      
      logger.info(`Call Operation ${type} on ${call_id} requested by ${req.user.id}`);
      const result = await smartfloService.callOperation(type, call_id, agent_id, intercom);
      res.json(result);
    } catch (error) {
      logger.error('CallOperation Error:', error);
      next(error);
    }
  },

  hangupCall: async (req, res, next) => {
    const schema = Joi.object({
        call_id: Joi.string().required()
    });

    const { error } = schema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    try {
      const { call_id } = req.body;
      logger.info(`Hangup Call ${call_id} requested by ${req.user.id}`);
      const result = await smartfloService.hangupCall(call_id);
      res.json(result);
    } catch (error) {
      logger.error('HangupCall Error:', error);
      next(error);
    }
  },

  // --- User Management (Smartflo Users) ---

  getSmartfloUsers: async (req, res, next) => {
    try {
      const result = await smartfloService.getUsers();
      res.json(result);
    } catch (error) {
      logger.error('GetSmartfloUsers Error:', error);
      next(error);
    }
  }
};

module.exports = smartfloController;
