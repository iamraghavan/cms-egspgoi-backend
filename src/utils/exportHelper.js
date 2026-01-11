const XLSX = require('xlsx');
const PDFDocument = require('pdfkit-table');

/**
 * Generate Excel Buffer
 * @param {Array} data - Array of Objects
 * @param {Array} columns - List of column keys to include
 * @returns {Buffer}
 */
const generateExcel = (data, columns) => {
    // Filter data based on columns
    const filteredData = data.map(item => {
        const row = {};
        columns.forEach(col => {
            row[col] = item[col] !== undefined && item[col] !== null ? item[col] : '';
        });
        return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(filteredData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Leads");

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};

/**
 * Generate CSV Buffer
 * @param {Array} data 
 * @param {Array} columns 
 * @returns {Buffer}
 */
const generateCSV = (data, columns) => {
    // Similar to Excel but return csv string buffer
    const filteredData = data.map(item => {
        const row = {};
        columns.forEach(col => {
            row[col] = item[col] !== undefined && item[col] !== null ? item[col] : '';
        });
        return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(filteredData);
    return XLSX.write({ Sheets: { Sheet1: worksheet }, SheetNames: ['Sheet1'] }, { type: 'buffer', bookType: 'csv' });
};

/**
 * Generate PDF Buffer
 * @param {Array} data 
 * @param {Array} columns 
 * @returns {Promise<Buffer>}
 */
const generatePDF = (data, columns) => {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 30, size: 'A4' });
        const buffers = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
            const pdfData = Buffer.concat(buffers);
            resolve(pdfData);
        });

        // Add Header
        doc.fontSize(18).text("Leads Export", { align: 'center' });
        doc.moveDown();

        // Prepare Table Data
        const table = {
            title: "Leads Report",
            headers: columns.map(col => col.toUpperCase().replace(/_/g, ' ')),
            rows: data.map(item => columns.map(col => {
                const val = item[col];
                return val !== undefined && val !== null ? String(val) : '';
            }))
        };

        // Draw Table
        doc.table(table, {
            prepareHeader: () => doc.font("Helvetica-Bold").fontSize(10),
            prepareRow: (row, i) => doc.font("Helvetica").fontSize(8)
        });

        doc.end();
    });
};

module.exports = { generateExcel, generateCSV, generatePDF };
