const { processBulkUpload } = require('../services/bulkUploadService');
const path = require('path');
const fs = require('fs');

const uploadLeads = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const result = await processBulkUpload(req.file.buffer, req.file.mimetype, req.user.id);

        res.json(result);
    } catch (error) {
        console.error('Bulk Upload Error:', error);
        res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
};

const downloadTemplate = (req, res) => {
    const type = req.query.type || 'csv';
    const filename = type === 'xlsx' ? 'lead_upload_template.xlsx' : 'lead_upload_template.csv';
    const filePath = path.join(__dirname, '../../templates', filename);

    if (fs.existsSync(filePath)) {
        res.download(filePath);
    } else {
        res.status(404).json({ message: 'Template not found' });
    }
};

module.exports = { uploadLeads, downloadTemplate };
