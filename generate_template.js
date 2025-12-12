const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const data = [
    {
        Name: 'John Doe',
        Phone: '9876543210',
        Email: 'john@example.com',
        College: 'ABC College',
        Course: 'B.Tech',
        State: 'Tamil Nadu',
        District: 'Chennai',
        'Admission Year': '2024',
        'Source Website': 'bulk_upload'
    },
    {
        Name: 'Jane Smith',
        Phone: '8765432109',
        Email: 'jane@example.com',
        College: 'XYZ University',
        Course: 'MBA',
        State: 'Karnataka',
        District: 'Bangalore',
        'Admission Year': '2024',
        'Source Website': 'bulk_upload'
    }
];

const ws = xlsx.utils.json_to_sheet(data);
const wb = xlsx.utils.book_new();
xlsx.utils.book_append_sheet(wb, ws, 'Leads');

const outputDir = path.join(__dirname, 'templates');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

xlsx.writeFile(wb, path.join(outputDir, 'lead_upload_template.xlsx'));
console.log('Excel template created.');
