const Joi = require('joi');

const TABLE_NAME = "Assets";

const assetSchema = Joi.object({
  id: Joi.string().uuid(),
  campaign_id: Joi.string().uuid().required(),
  name: Joi.string().required(),
  storage_url: Joi.string().uri().required(),
  file_type: Joi.string().required(),
  version: Joi.number().integer().min(1).default(1),
  status: Joi.string().valid('draft', 'review', 'approved').default('draft'),
  uploaded_by: Joi.string().uuid().required(),
  uploaded_at: Joi.string(),
  updated_at: Joi.string()
});

module.exports = {
  TABLE_NAME,
  schema: assetSchema
};
