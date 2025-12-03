const Joi = require('joi');

const TABLE_NAME = "Campaigns";

const campaignSchema = Joi.object({
  id: Joi.string().uuid(),
  name: Joi.string().required(),
  description: Joi.string().allow(null, ''),
  type: Joi.string().required(),
  platform: Joi.string().required(),
  status: Joi.string().valid('draft', 'scheduled', 'active', 'completed', 'paused').default('draft'),
  start_date: Joi.date().iso(),
  end_date: Joi.date().iso(),
  institution: Joi.string().required(), // e.g., "EGS Pillay Engineering College"
  objective: Joi.string().allow(null, ''), // e.g., "Promote B.E Admissions"
  target_audience: Joi.object().default({}), // e.g., { "age": "17-19", "location": "Tamil Nadu" }
  kpi: Joi.string().allow(null, ''), // e.g., "10,000 Leads"
  detailed_plan: Joi.object().default({}), // Channel-wise plan
  settings: Joi.object().default({}),
  created_by: Joi.string().uuid().required(),
  created_at: Joi.string(),
  updated_at: Joi.string()
});

module.exports = {
  TABLE_NAME,
  schema: campaignSchema
};
