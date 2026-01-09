const bcrypt = require('bcrypt');
const { getISTTimestamp } = require('../utils/timeUtils');
const { docClient } = require('../config/db');
const { PutCommand, QueryCommand, ScanCommand, GetCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../utils/jwtUtils');
const { TABLE_NAME: USERS_TABLE, schema: userSchema } = require('../models/userModel');
const { TABLE_NAME: ROLES_TABLE } = require('../models/roleModel');

const register = async (req, res) => {
  const { name, email, password, role_id, team_id, phone, designation, agent_number, caller_id, status, metadata } = req.body;

  try {
    // Check if user exists
    const checkUserCommand = new QueryCommand({
      TableName: USERS_TABLE,
      IndexName: "EmailIndex",
      KeyConditionExpression: "email = :email",
      ExpressionAttributeValues: { ":email": email }
    });

    const userCheck = await docClient.send(checkUserCommand);
    if (userCheck.Items.length > 0) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const userId = uuidv4();
    const newUser = {
      id: userId,
      name,
      email,
      password_hash: passwordHash,
      role_id,
      team_id,
      phone,
      designation,
      agent_number, // Smartflo Agent Number
      caller_id,    // Smartflo Caller ID
      status: status || 'active',
      metadata: metadata || {},
      created_at: getISTTimestamp(),
      updated_at: getISTTimestamp()
    };

    const createCommand = new PutCommand({
      TableName: USERS_TABLE,
      Item: newUser
    });

    await docClient.send(createCommand);

    // Remove password hash from response
    delete newUser.password_hash;
    res.status(201).json({ message: 'User registered successfully', user: newUser });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Find user
    const findUserCommand = new QueryCommand({
      TableName: USERS_TABLE,
      IndexName: "EmailIndex",
      KeyConditionExpression: "email = :email",
      ExpressionAttributeValues: { ":email": email }
    });

    const result = await docClient.send(findUserCommand);

    if (result.Items.length === 0) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const user = result.Items[0];

    // Check password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Get Role Name
    let roleName = 'Unknown';
    if (user.role_id) {
      const roleCommand = new GetCommand({
        TableName: ROLES_TABLE,
        Key: { id: user.role_id }
      });
      const roleResult = await docClient.send(roleCommand);
      if (roleResult.Item) {
        roleName = roleResult.Item.name;
      }
    }

    // Generate tokens
    const accessToken = generateAccessToken({ ...user, role_name: roleName });
    const refreshToken = generateRefreshToken(user);

    // Send Refresh Token in HTTP-Only Cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Only send over HTTPS in production
      sameSite: 'strict', // Prevent CSRF
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({
      message: 'Login successful',
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: roleName,
        agent_number: user.agent_number || null,
        caller_id: user.caller_id || null
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getProfile = async (req, res) => {
  try {
    const command = new GetCommand({
      TableName: USERS_TABLE,
      Key: { id: req.user.id }
    });

    const result = await docClient.send(command);
    if (!result.Item) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = result.Item;
    // Ensure Smartflo fields are present even if not in DB
    user.agent_number = user.agent_number || null;
    user.caller_id = user.caller_id || null;

    delete user.password_hash;
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getUsers = async (req, res) => {
  try {
    const { type } = req.query;

    let filterExpression = null;
    let expressionAttributeNames = { "#name": "name", "#status": "status" };
    let expressionAttributeValues = null;

    if (type === 'agent') {
      // 1. Get Role IDs for 'Admission Manager' and 'Admission Executive'
      const roleScan = new ScanCommand({
        TableName: ROLES_TABLE,
        FilterExpression: "#name IN (:r1, :r2)",
        ExpressionAttributeNames: { "#name": "name" },
        ExpressionAttributeValues: { ":r1": "Admission Manager", ":r2": "Admission Executive" }
      });
      const roleResult = await docClient.send(roleScan);

      if (roleResult.Items.length > 0) {
        const roleIds = roleResult.Items.map(r => r.id);

        // 2. Filter Users by these Role IDs
        // DynamoDB Scan Filter with IN
        filterExpression = "role_id IN (" + roleIds.map((_, i) => `:role${i}`).join(", ") + ")";
        expressionAttributeValues = {};
        roleIds.forEach((id, i) => {
          expressionAttributeValues[`:role${i}`] = id;
        });
      } else {
        // No agent roles found, return empty
        return res.json([]);
      }
    }

    const scanParams = {
      TableName: USERS_TABLE,
      ProjectionExpression: "id, #name, email, role_id, created_at, #status, is_available", // Added is_available
      ExpressionAttributeNames: expressionAttributeNames
    };

    if (filterExpression) {
      scanParams.FilterExpression = filterExpression;
      scanParams.ExpressionAttributeValues = expressionAttributeValues;
    }

    const command = new ScanCommand(scanParams);
    const result = await docClient.send(command);

    // Enrich with Role Name for frontend convenience
    // Fetch all roles to map names (optimized: we could just fetch the 2 agent roles if filtering, but for general listing we need all)
    // For now, let's keep it simple and just return the list. Frontend might need role names.
    // Let's do a quick fetch of roles if we didn't already.

    // Actually, sticking to the requested feature first.
    res.json(result.Items);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

const createUser = async (req, res) => {
  const { name, email, password, role, team_id, phone, designation, agent_number, caller_id, status, metadata } = req.body;

  try {
    // Check if user exists
    const checkUserCommand = new QueryCommand({
      TableName: USERS_TABLE,
      IndexName: "EmailIndex",
      KeyConditionExpression: "email = :email",
      ExpressionAttributeValues: { ":email": email }
    });

    const userCheck = await docClient.send(checkUserCommand);
    if (userCheck.Items.length > 0) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Resolve Role Name to ID
    let roleId = null;
    if (role) {
      const roleScan = new ScanCommand({
        TableName: ROLES_TABLE,
        FilterExpression: "#name = :name",
        ExpressionAttributeNames: { "#name": "name" },
        ExpressionAttributeValues: { ":name": role }
      });
      const roleResult = await docClient.send(roleScan);
      if (roleResult.Items.length > 0) {
        roleId = roleResult.Items[0].id;
      } else {
        return res.status(400).json({ message: `Role '${role}' not found` });
      }
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const userId = uuidv4();
    const newUser = {
      id: userId,
      name,
      email,
      password_hash: passwordHash,
      role_id: roleId,
      team_id,
      phone,
      designation,
      agent_number, // Smartflo Agent Number
      caller_id,    // Smartflo Caller ID
      status: status || 'active',
      metadata: metadata || {},
      created_at: getISTTimestamp(),
      updated_at: getISTTimestamp()
    };

    const createCommand = new PutCommand({
      TableName: USERS_TABLE,
      Item: newUser
    });

    await docClient.send(createCommand);

    // Remove password hash from response
    delete newUser.password_hash;
    res.status(201).json({ message: 'User created successfully', user: newUser });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

const refreshToken = async (req, res) => {
  const cookies = req.cookies;
  if (!cookies?.refreshToken) return res.status(401).json({ message: 'Refresh Token required' });

  const refreshToken = cookies.refreshToken;

  try {
    const decoded = verifyRefreshToken(refreshToken);

    // Find user to ensure they still exist and get current role
    const command = new GetCommand({
      TableName: USERS_TABLE,
      Key: { id: decoded.id }
    });
    const result = await docClient.send(command);

    if (!result.Item) return res.status(403).json({ message: 'User not found' });

    const user = result.Item;

    // Get Role Name
    let roleName = 'Unknown';
    if (user.role_id) {
      const roleCommand = new GetCommand({
        TableName: ROLES_TABLE,
        Key: { id: user.role_id }
      });
      const roleResult = await docClient.send(roleCommand);
      if (roleResult.Item) {
        roleName = roleResult.Item.name;
      }
    }

    const accessToken = generateAccessToken({ ...user, role_name: roleName });

    res.json({ accessToken });
  } catch (error) {
    console.error(error);
    return res.status(403).json({ message: 'Invalid Refresh Token' });
  }
};

const toggleAvailability = async (req, res, next) => {
  const { id } = req.user; // From auth middleware
  const { is_available } = req.body;

  if (typeof is_available !== 'boolean') {
    return res.status(400).json({ message: 'is_available must be a boolean' });
  }

  try {
    const command = new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { id },
      UpdateExpression: "SET is_available = :status, updated_at = :time",
      ExpressionAttributeValues: {
        ":status": is_available,
        ":time": getISTTimestamp()
      },
      ReturnValues: "ALL_NEW"
    });

    const result = await docClient.send(command);
    res.json({ message: 'Availability updated', user: result.Attributes });
  } catch (error) {
    console.error('Toggle Availability Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update User
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, phone, designation, status, is_available, weightage, active_leads_count, agent_number, caller_id } = req.body;

    const getCommand = new GetCommand({
      TableName: USERS_TABLE,
      Key: { id }
    });
    const getResult = await docClient.send(getCommand);
    if (!getResult.Item) {
      return res.status(404).json({ message: 'User not found' });
    }

    const updates = {};
    if (name) updates.name = name;
    if (email) updates.email = email; // Note: Updating email might break login if index isn't updated, but assuming standard update
    if (phone) updates.phone = phone;
    if (designation) updates.designation = designation;
    if (status) updates.status = status;
    if (is_available !== undefined) updates.is_available = is_available;
    if (weightage) updates.weightage = weightage;
    if (active_leads_count !== undefined) updates.active_leads_count = active_leads_count;
    if (agent_number !== undefined) updates.agent_number = agent_number;
    if (caller_id !== undefined) updates.caller_id = caller_id;

    // Role update logic
    if (role) {
      const roleScan = new ScanCommand({
        TableName: ROLES_TABLE,
        FilterExpression: "#name = :name",
        ExpressionAttributeNames: { "#name": "name" },
        ExpressionAttributeValues: { ":name": role }
      });
      const roleResult = await docClient.send(roleScan);
      if (roleResult.Items.length > 0) {
        updates.role_id = roleResult.Items[0].id;
      } else {
        return res.status(400).json({ message: `Role '${role}' not found` });
      }
    }

    updates.updated_at = getISTTimestamp();

    // Construct UpdateExpression
    let updateExp = "set";
    const expNames = {};
    const expValues = {};

    Object.keys(updates).forEach((key, index) => {
      const attrName = `#attr${index}`;
      const attrVal = `:val${index}`;
      updateExp += ` ${attrName} = ${attrVal},`;
      expNames[attrName] = key;
      expValues[attrVal] = updates[key];
    });

    // Remove trailing comma
    updateExp = updateExp.slice(0, -1);

    const command = new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { id },
      UpdateExpression: updateExp,
      ExpressionAttributeNames: expNames,
      ExpressionAttributeValues: expValues,
      ReturnValues: "ALL_NEW"
    });

    const result = await docClient.send(command);
    const updatedUser = result.Attributes;
    delete updatedUser.password_hash;

    res.json({ message: 'User updated successfully', user: updatedUser });
  } catch (error) {
    console.error('Update User Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete User
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.query; // 'hard' or 'soft'

    if (type === 'hard') {
      // Hard Delete - restricted to Super Admin (handled by RBAC usually, but double check safe)
      if (req.user.role !== 'Super Admin') {
        return res.status(403).json({ message: 'Only Super Admin can hard delete.' });
      }

      const { DeleteCommand } = require("@aws-sdk/lib-dynamodb");
      const command = new DeleteCommand({
        TableName: USERS_TABLE,
        Key: { id }
      });
      await docClient.send(command);
      return res.json({ message: 'User permanently deleted' });
    } else {
      // Soft Delete
      const command = new UpdateCommand({
        TableName: USERS_TABLE,
        Key: { id },
        UpdateExpression: "set status = :status, updated_at = :time",
        ExpressionAttributeValues: {
          ":status": "deleted",
          ":time": getISTTimestamp()
        }
      });
      await docClient.send(command);
      return res.json({ message: 'User soft deleted (status set to deleted)' });
    }
  } catch (error) {
    console.error('Delete User Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { register, login, getProfile, getUsers, createUser, refreshToken, toggleAvailability, updateUser, deleteUser };
