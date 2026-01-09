# Comprehensive Guide: Integrating Smartflo with Your Backend

This guide explains how to connect your backend with Tata Smartflo to enable:
1.  **Click-to-Call**: Initiating calls from the CRM (with "Dynamic Relationship" to Leads).
2.  **Webhooks**: Automatically updating Call Records in your CRM when calls end.
3.  **Hanging Up**: Validating and troubleshooting the Hangup feature.

---

## 1. Establishing the "Dynamic Relationship"
To link a Smartflo Call to a CRM Lead, we use the `ref_id` (Reference ID) field.

**How it works:**
1.  **Backend**: When initiating a call (`clickToCall`), we send the `Lead ID` as the `ref_id`.
2.  **Smartflo**: Connects the call.
3.  **Webhook**: When the call ends, Smartflo sends a webhook to your server containing `$ref_id`.
4.  **Backend**: Receives the webhook, reads `$ref_id`, and updates the corresponding Lead in the database.

**Status:**
- [x] Backend logic updated to send `ref_id`.
- [x] Webhook logic updated to read `ref_id`.

---

### 3. Smartflo Webhook Configuration (Exact Values)
Use these values in the "Add Webhook" screen (as seen in your screenshot):

| Field | Value |
| :--- | :--- |
| **Method** | `POST` (Change from GET) |
| **URL** | `https://cms-egspgoi.vercel.app/api/v1/smartflo/webhook` |
| **Trigger** | `Call hangup (Missed or Answered)` |
| **Call Type** | `Outbound` (and check `Inbound` if you want both) |
| **Content Type** | `JSON` |

**JSON Body (Copy & Paste this exactly):**
```json
{
  "uuid": "$uuid",
  "call_to_number": "$call_to_number",
  "caller_id_number": "$caller_id_number",
  "start_stamp": "$start_stamp",
  "answer_stamp": "$answer_stamp",
  "end_stamp": "$end_stamp",
  "hangup_cause": "$hangup_cause",
  "billsec": "$billsec",
  "digits_dialed": "$digits_dialed",
  "direction": "$direction",
  "duration": "$duration",
  "answered_agent": "$answered_agent",
  "answered_agent_name": "$answered_agent_name",
  "answered_agent_number": "$answered_agent_number",
  "missed_agent": "$missed_agent",
  "call_flow": "$call_flow",
  "broadcast_lead_fields": "$broadcast_lead_fields",
  "recording_url": "$recording_url",
  "call_status": "$call_status",
  "call_id": "$call_id",
  "outbound_sec": "$outbound_sec",
  "agent_ring_time": "$agent_ring_time",
  "agent_transfer_ring_time": "$agent_transfer_ring_time",
  "billing_circle": "$billing_circle",
  "call_connected": "$call_connected",
  "aws_call_recording_identifier": "$aws_call_recording_identifier",
  "customer_no_with_prefix": "$customer_number_with_prefix",
  "campaign_name": "$campaign_name",
  "campaign_id": "$campaign_id",
  "customer_ring_time": "$customer_ring_time",
  "reason_key": "$reason_key",
  "ref_id": "$ref_id"
}
```
*Note: The last field `ref_id` is crucial for linking calls to Leads.*

### ⚠️ Critical Check:
In your screenshot, the Destination is **Inbound**.
For **Click-to-Call** to work, you MUST create a Webhook for **Outbound** calls too (or check "Outbound" if multiselect is allowed).
1.  **Trigger**: `Call hangup (Missed or Answered)` (or `Call Answered by Customer (Click to Call)`)
2.  **Destination**: **Outbound** (Click to Call is an outbound action).

---

## 4. How to Test & Verify

### Method A: Simulation (Easy)
You don't need to make a real call to test the backend. Run this command in your terminal (Postman or Curl) to simulate a Smartflo webhook:

**Curl Command:**
```bash
curl -X POST https://cms-egspgoi.vercel.app/api/v1/smartflo/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "call_id": "test_call_123",
    "call_status": "answered",
    "direction": "outbound",
    "duration": "45",
    "ref_id": "REPLACE_WITH_REAL_LEAD_ID", 
    "agent_number": "123456",
    "customer_number": "9876543210"
  }'
```
*Replace `REPLACE_WITH_REAL_LEAD_ID` with an ID from your database (e.g., `lead-123`).*

**Expected Result:**
1.  API returns `200 OK`.
2.  Check your Database: The Lead with that ID should have a new note or updated `last_contacted_at`.

### Method B: Real World Test
1.  **Frontend**: Go to a Lead, click the **Phone Icon** (Initiate Call).
2.  **Phone**: Your agent phone rings -> Customer phone rings -> Talk for 10s -> Hangup.
3.  **Wait**: smartflo triggers the webhook (usually instant or within 30s).
4.  **Verify**: Refresh the Lead in your CRM. You should see the call logged in the Notes or Activity.

---

## 5. Troubleshooting "Hangup Failed"
If the "Hangup" button isn't working, it's usually because the `call_id` is missing.

### The Flow:
1.  **Frontend**: User clicks "Call".
2.  **Backend**: Calls Smartflo API -> Returns `response` (containing `call_id` or `uuid`).
3.  **Frontend**: **MUST SAVE** this `call_id` in the local component state.
4.  **Frontend**: User clicks "Hangup".
5.  **Frontend**: Sends `POST /api/v1/smartflo/hangup` with `{ "call_id": "saved_uuid" }`.

### Troubleshooting:
- Check the **Network Tab** in Chrome when you click "Call".
- Look at the Response. Does it have a `data.call_id` or `data.uuid`?
- *Note:* Smartflo's sync API response often contains `call_id`. If it's missing, you may need to rely on the "Dialed on Agent" webhook to get the ID, but typically for C2C, the initiation response is sufficient.

---

## 4. What's Next? (Automation)
Now that you have webhooks, your backend can automatically:
1.  **Log Calls**: Save a history of every call in the Lead's "Activity Log".
2.  **Update Status**: If `call_status` is "Connected" and `duration` > 30s, auto-move Lead to "Contacted".
3.  **Recordings**: The webhook provides `$recording_url`. You can save this link to play back calls later.

---
**Check the updated `smartfloWebhookController.js` to see how we handle these payloads.**
