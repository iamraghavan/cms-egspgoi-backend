const { v4: uuidv4 } = require('uuid');
const { docClient } = require('../config/db');
const { PutCommand, ScanCommand, GetCommand, QueryCommand, TransactWriteItemsCommand } = require("@aws-sdk/lib-dynamodb");
const { triggerCall } = require('../services/smartfloService');
const { TABLE_NAME: LEADS_TABLE, schema: leadSchema } = require('../models/leadModel');
const { TABLE_NAME: USERS_TABLE } = require('../models/userModel');
const logger = require('../utils/logger');
const Joi = require('joi');
const { getISTTimestamp, parseISTTimestamp } = require('../utils/timeUtils');
const { generateLeadRef } = require('../utils/idGenerator');
const { findBestAgent } = require('../services/assignmentService');

// Helper to check for existing lead using GSI
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

const createLead = async (req, res, next) => {
  // Internal Admin API
  const { name, phone, email, pipeline_id, college, course, state, district, admission_year, source_website, utm_params } = req.body;
    // Auto-Assignment Logic
    let assigned_to = req.user.id; 
    
    const bestAgent = await findBestAgent();
    if (bestAgent) {
        assigned_to = bestAgent.id;
        logger.info(`Auto-assigning internal lead to: ${bestAgent.name} (${bestAgent.id})`);
    } else {
        logger.warn('No available agents for auto-assignment. Assigning to creator.');
    }

    const newLead = {
      id,
      lead_reference_id,
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

    // Transaction: Create Lead + Update Agent Stats
    const transactItems = [
        {
            Put: {
                TableName: LEADS_TABLE,
                Item: newLead
            }
        }
    ];

    if (bestAgent) {
        transactItems.push({
            Update: {
                TableName: USERS_TABLE,
                Key: { id: bestAgent.id },
                UpdateExpression: "SET active_leads_count = if_not_exists(active_leads_count, :zero) + :inc, last_assigned_at = :now",
                ExpressionAttributeValues: {
                    ":inc": 1,
                    ":zero": 0,
                    ":now": getISTTimestamp()
                }
            }
        });
    }

    const command = new TransactWriteItemsCommand({
        TransactItems: transactItems
    });

    await docClient.send(command);
    logger.info(`Lead created successfully: ${id}`);
    res.status(201).json(newLead);
  } catch (error) {
    logger.error('Error creating lead:', error);
    next(error);
  }
};

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

        // 2. Auto-Assignment
        let assigned_to = null;
        const bestAgent = await findBestAgent();
        if (bestAgent) {
            assigned_to = bestAgent.id;
            logger.info(`Auto-assigning public lead to: ${bestAgent.name} (${bestAgent.id})`);
        } else {
            logger.warn('No available agents for public lead auto-assignment.');
        }

        // 3. Create New Lead
        const id = uuidv4();
        const lead_reference_id = generateLeadRef();

        const newLead = {
            id,
            lead_reference_id,
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
            assigned_to, 
            status: 'new',
            created_at: getISTTimestamp()
        };

        // Validate against internal model schema
        const { error: modelError } = leadSchema.validate(newLead);
        if (modelError) {
             logger.error(`Internal model validation failed for public lead: ${modelError.details[0].message}`);
             return res.status(400).json({ message: 'Invalid lead data format.' });
        }

        // Transaction: Create Lead + Update Agent Stats
        const transactItems = [
            {
                Put: {
                    TableName: LEADS_TABLE,
                    Item: newLead
                }
            }
        ];

        if (bestAgent) {
            transactItems.push({
                Update: {
                    TableName: USERS_TABLE,
                    Key: { id: bestAgent.id },
                    UpdateExpression: "SET active_leads_count = if_not_exists(active_leads_count, :zero) + :inc, last_assigned_at = :now",
                    ExpressionAttributeValues: {
                        ":inc": 1,
                        ":zero": 0,
                        ":now": getISTTimestamp()
                    }
                }
            });
        }

        const command = new TransactWriteItemsCommand({
            TransactItems: transactItems
        });

        await docClient.send(command);
        logger.info(`Public lead submitted: ${id}`);
        res.status(201).json({ message: 'Lead submitted successfully', lead_id: id });

    } catch (error) {
        logger.error('Submit Lead Error:', error);
        next(error);
    }
};

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

const addNote = async (req, res, next) => {
    const { id } = req.params;
    const { content } = req.body;
    const author_id = req.user.id;
    const author_name = req.user.name || 'Unknown';

    if (!content) {
        return res.status(400).json({ message: 'Note content is required' });
    }

    try {
        // Fetch current lead to get existing notes
        const getCommand = new GetCommand({
            TableName: LEADS_TABLE,
            Key: { id }
        });
        const leadResult = await docClient.send(getCommand);
        
        if (!leadResult.Item) {
            return res.status(404).json({ message: 'Lead not found' });
        }

        const currentNotes = leadResult.Item.notes || [];
        const newNote = {
            content,
            author_id,
            author_name,
            created_at: getISTTimestamp()
        };

        const updatedNotes = [...currentNotes, newNote];

        const updateCommand = new PutCommand({
            TableName: LEADS_TABLE,
            Item: { ...leadResult.Item, notes: updatedNotes, updated_at: getISTTimestamp() }
        });

        await docClient.send(updateCommand);
        res.json({ message: 'Note added successfully', note: newNote });
    } catch (error) {
        logger.error('Add Note Error:', error);
        next(error);
    }
};

const transferLead = async (req, res, next) => {
    const { id } = req.params;
    const { new_agent_id } = req.body;

    if (!new_agent_id) {
        return res.status(400).json({ message: 'New Agent ID is required' });
    }

    try {
        const getCommand = new GetCommand({
            TableName: LEADS_TABLE,
            Key: { id }
        });
        const leadResult = await docClient.send(getCommand);
        
        if (!leadResult.Item) {
            return res.status(404).json({ message: 'Lead not found' });
        }

        const updateCommand = new PutCommand({
            TableName: LEADS_TABLE,
            Item: { ...leadResult.Item, assigned_to: new_agent_id, updated_at: getISTTimestamp() }
        });

        await docClient.send(updateCommand);
        res.json({ message: 'Lead transferred successfully' });
    } catch (error) {
        logger.error('Transfer Lead Error:', error);
        next(error);
    }
};

const updateLeadStatus = async (req, res, next) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
        return res.status(400).json({ message: 'Status is required' });
    }

    try {
        const getCommand = new GetCommand({
            TableName: LEADS_TABLE,
            Key: { id }
        });
        const leadResult = await docClient.send(getCommand);
        
        if (!leadResult.Item) {
            return res.status(404).json({ message: 'Lead not found' });
        }

        const updateCommand = new PutCommand({
            TableName: LEADS_TABLE,
            Item: { ...leadResult.Item, status, updated_at: getISTTimestamp() }
        });

        await docClient.send(updateCommand);
        res.json({ message: 'Lead status updated successfully', status });
    } catch (error) {
        logger.error('Update Lead Status Error:', error);
        next(error);
    }
};

module.exports = { createLead, getLeads, initiateCall, submitLead, addNote, transferLead, updateLeadStatus };
