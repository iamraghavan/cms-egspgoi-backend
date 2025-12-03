const Joi = require('joi');

const TABLE_NAME = "PaymentRecords";

const paymentRecordSchema = Joi.object({
  id: Joi.string().uuid(),
  date: Joi.string().required(), // User input date, usually ISO or specific format. Keeping string.
  transfer_by: Joi.string().required(),
  payment_id: Joi.string().allow(null, ''),
  payment_method: Joi.string().required(), // e.g., NEFT, UPI, Cheque
  amount: Joi.number().positive().required(),
  from_account: Joi.string().allow(null, ''),
  transaction_id: Joi.string().required(),
  purpose: Joi.string().allow(null, ''),
  remarks: Joi.string().allow(null, ''),
  created_by: Joi.string().uuid().required(),
  created_at: Joi.string()
});

module.exports = {
  TABLE_NAME,
  schema: paymentRecordSchema
};
