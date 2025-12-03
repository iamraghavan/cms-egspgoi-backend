const Joi = require('joi');

const TABLE_NAME = "Integrations";

const integrationSchema = Joi.object({
  service_name: Joi.string().required(),
  api_key: Joi.string().required(),
  config: Joi.object().default({}),
  updated_at: Joi.string()
});

module.exports = {
  TABLE_NAME,
  schema: integrationSchema
};
