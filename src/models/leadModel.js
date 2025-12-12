const Joi = require('joi');

const TABLE_NAME = "Leads";

const leadSchema = Joi.object({
  id: Joi.string().uuid(),
  lead_reference_id: Joi.string().required(), // Custom ID: egsp-admission-YYYYMMDD-XXXXXX
  name: Joi.string().required(),
  phone: Joi.string().pattern(/^[0-9]+$/).required(),
  email: Joi.string().email().allow(null, ''),
  college: Joi.string().required(), // Mandatory for internal creation
  course: Joi.string().required(), // Mandatory for internal creation
  state: Joi.string().allow(null, ''),
  district: Joi.string().allow(null, ''),
  admission_year: Joi.string().required(), // e.g., "2025"
  source_website: Joi.string().required(), // e.g., "example.com"
  utm_params: Joi.object().default({}),
  form_data: Joi.object().default({}), // Catch-all for other form fields
  pipeline_id: Joi.string().uuid().allow(null),
  assigned_to: Joi.string().uuid().allow(null), // Can be null for auto-assignment later
  notes: Joi.array().items(
    Joi.object({
        content: Joi.string().required(),
        author_id: Joi.string().required(),
        author_name: Joi.string().optional(),
        created_at: Joi.string().required()
    })
  ).default([]),
  status: Joi.string().default('new'),
  created_at: Joi.string(),
  updated_at: Joi.string()
});

module.exports = {
  TABLE_NAME,
  schema: leadSchema
};
