const axios = require('axios');
const logger = require('../utils/logger');

const GEN_AI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

const generateContent = async (topic) => {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error("GEMINI_API_KEY is not configured in environment variables.");
        }

        const prompt = `Create a blog post in plain HTML with inline CSS only. Topic: ${topic}. Return JSON with title, summary, keywords, html_content. Do not include markdown formatting like \`\`\`json. Just the raw JSON string.`;

        const payload = {
            contents: [
                {
                    parts: [
                        {
                            text: prompt
                        }
                    ]
                }
            ]
        };

        const response = await axios.post(`${GEN_AI_URL}?key=${apiKey}`, payload, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.data && response.data.candidates && response.data.candidates.length > 0) {
            const rawText = response.data.candidates[0].content.parts[0].text;
            
            // Attempt to parse JSON if the model followed instructions
            try {
                // Remove any accidental markdown wrapping if present
                const cleanedText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
                return JSON.parse(cleanedText);
            } catch (jsonError) {
                logger.warn("Gemini response was not valid JSON, returning raw text.", jsonError);
                return { raw_content: rawText };
            }
        } else {
            throw new Error("No content generated from Gemini.");
        }

    } catch (error) {
        logger.error("Gemini API Error:", error.response ? error.response.data : error.message);
        throw error;
    }
};

module.exports = { generateContent };
