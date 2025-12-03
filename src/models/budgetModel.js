const Joi = require('joi');

const BUDGET_TABLE_NAME = "Budgets";
const PROOF_TABLE_NAME = "BudgetProofs";

const budgetSchema = Joi.object({
  id: Joi.string().uuid(),
  campaign_id: Joi.string().uuid().required(),
  amount: Joi.number().positive().required(),
  status: Joi.string().valid('pending', 'approved', 'rejected').default('pending'),
  approved_by: Joi.string().uuid().allow(null),
  created_at: Joi.string()
});

const proofSchema = Joi.object({
  id: Joi.string().uuid(),
  budget_id: Joi.string().uuid().required(),
  transaction_ref: Joi.string().required(),
  proof_url: Joi.string().uri().required(),
  status: Joi.string().valid('pending', 'verified', 'rejected').default('pending'),
  uploaded_by: Joi.string().uuid().required(),
  verified_by: Joi.string().uuid().allow(null),
  uploaded_at: Joi.string()
});

module.exports = {
  BUDGET_TABLE_NAME,
  PROOF_TABLE_NAME,
  budgetSchema,
  proofSchema
};
