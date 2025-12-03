# Admissions CRM API

## Introduction

This is a comprehensive Admissions CRM API designed to manage student admissions, campaigns, leads, budgets, and communications. It leverages AWS DynamoDB for storage and integrates with Smartflo for telephony operations.

## Features

- **User Management**: Authentication, Registration, and Role-Based Access Control (RBAC).
- **Campaign Management**: Create and track marketing campaigns.
- **Lead Management**: Capture, assign, and track leads.
- **Budget Management**: Manage campaign budgets and approve/reject requests.
- **Accounting**: Track payment records and ad spends.
- **Asset Management**: Upload and manage campaign assets.
- **Telephony Integration**: Click-to-call, live call monitoring, and call recording via Smartflo.

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: AWS DynamoDB
- **Authentication**: JSON Web Tokens (JWT)
- **Logging**: Winston, Morgan
- **Security**: Helmet, HPP, Rate Limiting, CORS
- **Validation**: Joi
- **External Services**: Smartflo (Telephony)

## Prerequisites

- Node.js (v14 or higher)
- AWS Account with DynamoDB access
- Smartflo Account (for telephony features)

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd cms-egspec
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Configuration

Create a `.env` file in the root directory with the following variables:

```env
PORT=3000
NODE_ENV=development

# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
# DYNAMODB_ENDPOINT=http://localhost:8000 # For local DynamoDB

# Security
JWT_SECRET=your_jwt_secret

# Smartflo Configuration (If applicable)
SMARTFLO_API_KEY=your_smartflo_key
```

## Running the Application

Start the server:

```bash
npm start
```

The server will start on port 3000 (or the port specified in `.env`).

## API Endpoints

### Authentication
- `POST /api/v1/auth/register`: Register a new user.
- `POST /api/v1/auth/login`: Login user.
- `POST /api/v1/auth/refresh`: Refresh access token.
- `GET /api/v1/auth/profile`: Get current user profile.

### Users (Admin)
- `GET /api/v1/users`: Get all users.
- `POST /api/v1/users`: Create a new user.

### Campaigns
- `POST /api/v1/campaigns`: Create a new campaign.
- `GET /api/v1/campaigns`: Get all campaigns.
- `PATCH /api/v1/campaigns/:id/status`: Update campaign status.

### Leads
- `POST /api/v1/leads/submit`: Submit a lead (Public).
- `POST /api/v1/leads`: Create a lead (Internal).
- `GET /api/v1/leads`: Get leads.
- `POST /api/v1/leads/:id/call`: Initiate a call.

### Accounting
- `POST /api/v1/accounting/payments`: Create payment record.
- `GET /api/v1/accounting/payments`: Get payment records.
- `POST /api/v1/accounting/ad-spends`: Create ad spend record.
- `GET /api/v1/accounting/ad-spends`: Get ad spend records.

### Smartflo (Telephony)
- `POST /api/v1/smartflo/click-to-call`: Initiate a call.
- `GET /api/v1/smartflo/live-calls`: Get live calls.
- `GET /api/v1/smartflo/call-records`: Get call records.
- `POST /api/v1/smartflo/call-operation`: Monitor/Whisper/Barge/Transfer.
- `POST /api/v1/smartflo/hangup`: Hangup a call.
- `GET /api/v1/smartflo/users`: Get Smartflo users.

## Usage

Use Postman or curl to interact with the API. The `postman_collection.json` file is included in the root directory for easy import.

## License

ISC
