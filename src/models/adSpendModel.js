const Joi = require('joi');

const TABLE_NAME = "AdSpends";

const adSpendSchema = Joi.object({
  id: Joi.string().uuid(),
  date: Joi.string().required(),
  platform: Joi.string().required(), // e.g., Google Ads, Meta Ads
  budget_allocated: Joi.number().min(0).required(),
  actual_spend: Joi.number().min(0).required(),
  invoice_no: Joi.string().allow(null, ''),
  invoice_url: Joi.string().uri().allow(null, ''), // New field for invoice copy URL
  remarks: Joi.string().allow(null, ''),
  campaign_id: Joi.string().uuid().allow(null), // Optional link to a specific campaign
  created_by: Joi.string().uuid().required(),
  created_at: Joi.string()
});

module.exports = {
  TABLE_NAME,
  schema: adSpendSchema
};
