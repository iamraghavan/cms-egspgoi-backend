const { PutCommand, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient } = require("../config/db");
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const { TABLE_NAME: USERS_TABLE } = require('../models/userModel');
const { TABLE_NAME: ROLES_TABLE } = require('../models/roleModel');

const seedUsers = async () => {
  try {
    // 1. Fetch all roles
    const roleScan = new ScanCommand({ TableName: ROLES_TABLE });
    const rolesResult = await docClient.send(roleScan);
    const roles = rolesResult.Items;

    if (!roles || roles.length === 0) {
        console.log("No roles found. Please run seedData.js first.");
        return;
    }

    // 2. Define users to create
    const usersToCreate = [
        { name: 'Marketing Manager', email: 'marketing@example.com', role: 'Marketing Manager' },
        { name: 'Finance Manager', email: 'finance@example.com', role: 'Finance' },
        { name: 'Admission Manager', email: 'admission_manager@example.com', role: 'Admission Manager' },
        { name: 'Admission Executive', email: 'admission_exec@example.com', role: 'Admission Executive' },
        { name: 'Designer', email: 'designer@example.com', role: 'Designer' },
        { name: 'Editor', email: 'editor@example.com', role: 'Editor' }
    ];

    // 3. Create users
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('password123', salt); // Default password

    for (const u of usersToCreate) {
        // Find role id
        const role = roles.find(r => r.name === u.role);
        if (!role) {
            console.log(`Role '${u.role}' not found. Skipping user '${u.name}'.`);
            continue;
        }

        // Check if user exists
        const userScan = new ScanCommand({
            TableName: USERS_TABLE,
            FilterExpression: "email = :email",
            ExpressionAttributeValues: { ":email": u.email }
        });
        const userCheck = await docClient.send(userScan);

        if (userCheck.Items.length > 0) {
            console.log(`User '${u.email}' already exists. Skipping.`);
            continue;
        }

        const newUser = {
            id: uuidv4(),
            name: u.name,
            email: u.email,
            password_hash: passwordHash,
            role_id: role.id,
            status: 'active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        const command = new PutCommand({
            TableName: USERS_TABLE,
            Item: newUser
        });

        await docClient.send(command);
        console.log(`User '${u.email}' created with role '${u.role}'.`);
    }

    console.log("Users seeded successfully.");

  } catch (error) {
    console.error("Failed to seed users:", error);
  }
};

seedUsers();
