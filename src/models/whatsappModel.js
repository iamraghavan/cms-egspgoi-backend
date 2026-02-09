const Joi = require('joi');

const WHATSAPP_HISTORY_TABLE = 'WhatsApp_History';

const whatsappHistorySchema = Joi.object({
    id: Joi.string().uuid().required(),
    lead_id: Joi.string().uuid().required(),
    phone: Joi.string().required(),
    template_name: Joi.string().required(),
    variables: Joi.object().optional(),
    status: Joi.string().valid('success', 'failed').required(),
    message_id: Joi.string().allow(null, ''),
    message_wamid: Joi.string().allow(null, ''),
    error: Joi.string().allow(null, ''),
    created_at: Joi.string().isoDate().required(),
    sent_by: Joi.string().uuid().required()
});

module.exports = {
    WHATSAPP_HISTORY_TABLE,
    schema: whatsappHistorySchema
};
