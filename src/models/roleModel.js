const Joi = require('joi');

const TABLE_NAME = "Roles";

const roleSchema = Joi.object({
  id: Joi.string().uuid(),
  name: Joi.string().required(),
  permissions: Joi.object().required()
});

module.exports = {
  TABLE_NAME,
  schema: roleSchema
};
