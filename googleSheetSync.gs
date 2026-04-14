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
  const lastRow = sheet.getLastRow();
  const range = sheet.getRange(lastRow, 1, 1, sheet.getLastColumn());
  const values = range.getValues()[0];
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  // Convert row to JSON object
  const payload = {};
  headers.forEach((header, index) => {
    // Clean header name for JSON keys
    const key = header.toLowerCase().replace(/[^a-z0-9]/g, '_');
    payload[key] = values[index];
    // Also keep raw header as backup
    payload[`raw_${key}`] = header;
  });

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload)
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
