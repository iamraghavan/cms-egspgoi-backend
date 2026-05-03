/**
 * Google Apps Script for syncing Google Sheet rows to CMS Backend.
 * Paste this into Extensions > Apps Script in your Google Sheet.
 */

// REPLACE with your actual deployed Vercel URL
const BACKEND_URL = 'https://cms-egspgoi.vercel.app/api/v1/meta/sheets';

/**
 * Automatically triggers when a new row is added (depends on how you trigger it).
 * Best used with an Installable Trigger for 'On Form Submit' or 'On Change'.
 */
function syncLeadToCMS(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  let rowData = [];
  let headers = [];

  // If triggered by a form submit, use the values from the event object
  if (e && e.values) {
    rowData = e.values;
    headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  } else {
    // Manual trigger or On Change - get the last row
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    rowData = sheet.getRange(lastRow, 1, 1, lastCol).getValues()[0];
    headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  }

  // Convert row to JSON object
  const payload = {};
  let hasData = false;
  let phoneValue = '';
  let nameValue = '';

  headers.forEach((header, index) => {
    if (!header) return;
    const key = header.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const value = rowData[index];
    payload[key] = value;
    
    // Check for critical fields
    if (key.includes('phone')) phoneValue = value;
    if (key.includes('name')) nameValue = value;
    
    if (value && value.toString().trim() !== '') hasData = true;
  });

  // 🛑 GUARDRAILS: Don't send if empty or missing contact info
  if (!hasData || (!phoneValue && !nameValue)) {
    Logger.log('Skipping sync: Row is empty or missing name/phone.');
    return;
  }

  // Don't send dummy "Sheet Lead" placeholders if they originate from the sheet itself
  if (nameValue === 'Sheet Lead') {
    Logger.log('Skipping sync: Dummy record detected.');
    return;
  }

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(BACKEND_URL, options);
    Logger.log('Response: ' + response.getContentText());
  } catch (err) {
    Logger.log('Error: ' + err.toString());
  }
}

/**
 * Manual test function to sync the last row.
 */
function testSync() {
  syncLeadToCMS();
}
