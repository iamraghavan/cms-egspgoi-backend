const Joi = require('joi');

const TABLE_NAME = "Users";

const userSchema = Joi.object({
  id: Joi.string().uuid(),
  name: Joi.string().required(),
  email: Joi.string().email().required(),
  password: Joi.string().required(), // In code this will be hash
  role_id: Joi.string().uuid().required(),
  team_id: Joi.string().uuid().allow(null, ''),
  phone: Joi.string().allow(null, ''),
  designation: Joi.string().allow(null, ''),
  status: Joi.string().valid('active', 'inactive', 'suspended').default('active'),
  agent_number: Joi.string().allow(null, ''), // Smartflo Agent Number (e.g. 1001)
  caller_id: Joi.string().allow(null, ''),    // Smartflo Caller ID (DID)
  is_available: Joi.boolean().default(true), // For auto-assignment
  weightage: Joi.number().integer().min(1).default(1), // Weighted distribution
  active_leads_count: Joi.number().integer().min(0).default(0), // Load balancing
  last_assigned_at: Joi.string().allow(null), // Tie-breaker
  metadata: Joi.object().default({}),
  preferences: Joi.object({
    currency: Joi.string().default('INR'),
    language: Joi.string().default('en'),
    timezone: Joi.string().default('Asia/Kolkata'),
    date_format: Joi.string().default('DD/MM/YYYY'),
    theme: Joi.string().valid('light', 'dark', 'system').default('system')
  }).default({}),
  is_deleted: Joi.boolean().default(false),
  deleted_at: Joi.string().allow(null),
  created_at: Joi.string(),
  updated_at: Joi.string()
});

module.exports = {
  TABLE_NAME,
  schema: userSchema
};
