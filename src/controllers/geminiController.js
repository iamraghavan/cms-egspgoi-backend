const { generateContent } = require('../services/geminiService');
const { sendSuccess, sendError } = require('../utils/responseUtils');

const generateBlog = async (req, res) => {
    try {
        const { topic } = req.body;

        if (!topic) {
            return sendError(res, { message: 'Topic is required.' }, 'Generate Blog', 400);
        }

        const result = await generateContent(topic);
        sendSuccess(res, result, 'Content generated successfully');
    } catch (error) {
        sendError(res, error, 'Generate Blog');
    }
};

module.exports = { generateBlog };
