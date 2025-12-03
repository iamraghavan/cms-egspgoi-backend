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
  smartflo_agent_id: Joi.string().allow(null, ''), // ID of the agent in Smartflo system
  metadata: Joi.object().default({}),
  created_at: Joi.string(),
  updated_at: Joi.string()
});

module.exports = {
  TABLE_NAME,
  schema: userSchema
};
