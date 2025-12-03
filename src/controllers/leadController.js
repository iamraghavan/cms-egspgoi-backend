const { v4: uuidv4 } = require('uuid');
const { docClient } = require('../config/db');
const { PutCommand, ScanCommand, GetCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { triggerCall } = require('../services/smartfloService');
const { TABLE_NAME: LEADS_TABLE, schema: leadSchema } = require('../models/leadModel');
const logger = require('../utils/logger');
const Joi = require('joi');
const { getISTTimestamp, parseISTTimestamp } = require('../utils/timeUtils');

/**
 * Helper to check for existing lead using GSI.
 *
 * @param {string} phone - The phone number.
 * @param {string} admission_year - The admission year.
 * @param {string} source_website - The source website.
 * @returns {Promise<Object|null>} The existing lead or null.
 */
const findExistingLead = async (phone, admission_year, source_website) => {
    try {
        // Optimization: Use GSI 'PhoneIndex' for O(1) lookup instead of Scan
        const command = new QueryCommand({
            TableName: LEADS_TABLE,
            IndexName: "PhoneIndex",
            KeyConditionExpression: "phone = :phone",
            FilterExpression: "admission_year = :year AND source_website = :source",
            ExpressionAttributeValues: {
                ":phone": phone,
                ":year": admission_year,
                ":source": source_website
            }
        });
        
        const result = await docClient.send(command);
        return result.Items[0];
    } catch (error) {
        // Fallback to Scan if GSI doesn't exist (Migration safety)
        if (error.name === 'ValidationException' || error.name === 'ResourceNotFoundException') {
            logger.warn('PhoneIndex GSI not found, falling back to Scan. Please update DynamoDB schema.');
            const command = new ScanCommand({
                TableName: LEADS_TABLE,
                FilterExpression: "phone = :phone AND admission_year = :year AND source_website = :source",
                ExpressionAttributeValues: {
                    ":phone": phone,
                    ":year": admission_year,
                    ":source": source_website
                }
            });
            const result = await docClient.send(command);
            return result.Items[0];
        }
        throw error;
    }
};

/**
 * Creates a new lead (Internal Admin API).
 *
 * @param {Object} req - The request object.
 * @param {Object} req.body - The request body.
 * @param {string} req.body.name - The lead name.
 * @param {string} req.body.phone - The lead phone.
 * @param {string} req.body.email - The lead email.
 * @param {string} req.body.pipeline_id - The pipeline ID.
 * @param {string} req.body.college - The college name.
 * @param {string} req.body.course - The course name.
 * @param {string} req.body.state - The state.
 * @param {string} req.body.district - The district.
 * @param {string} [req.body.admission_year] - The admission year.
 * @param {string} [req.body.source_website] - The source website.
 * @param {Object} [req.body.utm_params] - UTM parameters.
 * @param {Object} req.user - The authenticated user.
 * @param {string} req.user.id - The ID of the user creating the lead.
 * @param {Object} res - The response object.
 * @param {Function} next - The next middleware function.
 * @returns {void}
 */
const createLead = async (req, res, next) => {
  // Internal Admin API
  const { name, phone, email, pipeline_id, college, course, state, district, admission_year, source_website, utm_params } = req.body;
  const assigned_to = req.user.id; 

  try {
    const id = uuidv4();
    const newLead = {
      id,
      name,
      phone,
      email,
      college,
      course,
      state,
      district,
      admission_year: admission_year || new Date().getFullYear().toString(),
      source_website: source_website || 'internal_dashboard',
      utm_params: utm_params || {},
      pipeline_id,
      assigned_to,
      status: 'new',
      created_at: getISTTimestamp()
    };
    
    // Validate
    const { error } = leadSchema.validate(newLead);
    if (error) {
        logger.warn(`Lead validation failed: ${error.details[0].message}`);
        return res.status(400).json({ message: error.details[0].message });
    }

    const command = new PutCommand({
      TableName: LEADS_TABLE,
      Item: newLead
    });

    await docClient.send(command);
    logger.info(`Lead created successfully: ${id}`);
    res.status(201).json(newLead);
  } catch (error) {
    logger.error('Error creating lead:', error);
    next(error);
  }
};

/**
 * Submits a lead (Secure Public/External API).
 *
 * @param {Object} req - The request object.
 * @param {Object} req.body - The request body.
 * @param {string} req.body.name - The lead name.
 * @param {string} req.body.email - The lead email.
 * @param {string} req.body.phone - The lead phone.
 * @param {string} req.body.admission_year - The admission year.
 * @param {string} req.body.source_website - The source website.
 * @param {string} [req.body.college] - The college name.
 * @param {string} [req.body.course] - The course name.
 * @param {string} [req.body.state] - The state.
 * @param {string} [req.body.district] - The district.
 * @param {string} [req.body.utm_source] - UTM Source.
 * @param {string} [req.body.utm_medium] - UTM Medium.
 * @param {string} [req.body.utm_campaign] - UTM Campaign.
 * @param {Object} res - The response object.
 * @param {Function} next - The next middleware function.
 * @returns {void}
 */
const submitLead = async (req, res, next) => {
    // Secure Public/External API
    const { 
        name, email, phone, 
        college, course, state, district, 
        admission_year, source_website, 
        utm_source, utm_medium, utm_campaign,
        ...otherDetails 
    } = req.body;

    // Strict Input Validation for Public API
    const submissionSchema = Joi.object({
        phone: Joi.string().required(),
        admission_year: Joi.string().required(),
        source_website: Joi.string().required(),
        name: Joi.string().required(),
        email: Joi.string().email().optional().allow(''),
        college: Joi.string().optional(),
        course: Joi.string().optional(),
        state: Joi.string().optional(),
        district: Joi.string().optional(),
        utm_source: Joi.string().optional(),
        utm_medium: Joi.string().optional(),
        utm_campaign: Joi.string().optional()
    }).unknown(true); // Allow other fields

    const { error } = submissionSchema.validate(req.body);
    if (error) {
        logger.warn(`Public lead submission validation failed: ${error.details[0].message}`);
        return res.status(400).json({ message: error.details[0].message });
    }

    try {
        // 1. Check Uniqueness (Optimized)
        const existingLead = await findExistingLead(phone, admission_year, source_website);
        
        if (existingLead) {
            logger.info(`Duplicate lead attempt: ${phone} (${source_website})`);
            return res.status(200).json({ message: 'Lead already exists.', lead_id: existingLead.id });
        }

        // 2. Create New Lead
        const id = uuidv4();
        const newLead = {
            id,
            name,
            email,
            phone,
            college,
            course,
            state,
            district,
            admission_year,
            source_website,
            utm_params: {
                source: utm_source,
                medium: utm_medium,
                campaign: utm_campaign
            },
            form_data: otherDetails, 
            assigned_to: null, 
            status: 'new',
            created_at: getISTTimestamp()
        };

        // Validate against internal model schema
        const { error: modelError } = leadSchema.validate(newLead);
        if (modelError) {
             logger.error(`Internal model validation failed for public lead: ${modelError.details[0].message}`);
             return res.status(400).json({ message: 'Invalid lead data format.' });
        }

        const command = new PutCommand({
            TableName: LEADS_TABLE,
            Item: newLead
        });

        await docClient.send(command);
        logger.info(`Public lead submitted: ${id}`);
        res.status(201).json({ message: 'Lead submitted successfully', lead_id: id });

    } catch (error) {
        logger.error('Submit Lead Error:', error);
        next(error);
    }
};

/**
 * Retrieves leads.
 *
 * @param {Object} req - The request object.
 * @param {Object} req.user - The authenticated user.
 * @param {Object} res - The response object.
 * @param {Function} next - The next middleware function.
 * @returns {void}
 */
const getLeads = async (req, res, next) => {
  try {
    let command;
    // Filter by assigned user if not manager/admin
    // Security: Enforce data scoping
    if (req.user.role !== 'Super Admin' && req.user.role !== 'Admission Manager') {
        command = new ScanCommand({
            TableName: LEADS_TABLE,
            FilterExpression: "assigned_to = :assigned_to",
            ExpressionAttributeValues: { ":assigned_to": req.user.id }
        });
    } else {
        command = new ScanCommand({ TableName: LEADS_TABLE });
    }
    
    const result = await docClient.send(command);
    // Sort in memory (DynamoDB Scan doesn't support sort)
    // Optimization: For large datasets, this should be paginated and sorted via GSI on created_at
    const leads = result.Items.sort((a, b) => parseISTTimestamp(b.created_at) - parseISTTimestamp(a.created_at));
    res.json(leads);
  } catch (error) {
    logger.error('Get Leads Error:', error);
    next(error);
  }
};

/**
 * Initiates a call for a lead.
 *
 * @param {Object} req - The request object.
 * @param {Object} req.params - The route parameters.
 * @param {string} req.params.id - The ID of the lead.
 * @param {Object} req.body - The request body.
 * @param {string} [req.body.agent_number] - The agent's number.
 * @param {Object} res - The response object.
 * @param {Function} next - The next middleware function.
 * @returns {void}
 */
const initiateCall = async (req, res, next) => {
  const { id } = req.params;
  // Security: Validate agent number from user profile, don't trust body blindly if possible
  // For now, allow body override but log it
  const agentNumber = req.body.agent_number || '1234567890'; 

  try {
    const command = new GetCommand({
        TableName: LEADS_TABLE,
        Key: { id }
    });
    const result = await docClient.send(command);

    if (!result.Item) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    const customerNumber = result.Item.phone;
    logger.info(`Initiating call for Lead ${id} to ${customerNumber} by Agent ${agentNumber}`);
    
    await triggerCall(agentNumber, customerNumber);

    res.json({ message: 'Call initiated successfully' });
  } catch (error) {
    logger.error('Initiate Call Error:', error);
    next(error);
  }
};

module.exports = { createLead, getLeads, initiateCall, submitLead };
