const bcrypt = require('bcrypt');
const { getISTTimestamp } = require('../utils/timeUtils');
const { docClient } = require('../config/db');
const { PutCommand, QueryCommand, ScanCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../utils/jwtUtils');
const { TABLE_NAME: USERS_TABLE, schema: userSchema } = require('../models/userModel');
const { TABLE_NAME: ROLES_TABLE } = require('../models/roleModel');
const { v4: uuidv4 } = require('uuid');

/**
 * Registers a new user.
 *
 * @param {Object} req - The request object.
 * @param {Object} req.body - The body of the request.
 * @param {string} req.body.name - The name of the user.
 * @param {string} req.body.email - The email of the user.
 * @param {string} req.body.password - The password of the user.
 * @param {string} req.body.role_id - The role ID of the user.
 * @param {string} [req.body.team_id] - The team ID (optional).
 * @param {string} [req.body.phone] - The phone number (optional).
 * @param {string} [req.body.designation] - The designation (optional).
 * @param {string} [req.body.status] - The status (default: 'active').
 * @param {Object} [req.body.metadata] - Additional metadata (optional).
 * @param {Object} res - The response object.
 * @returns {void}
 */
const register = async (req, res) => {
  const { name, email, password, role_id, team_id, phone, designation, status, metadata } = req.body;

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

/**
 * Logs in a user.
 *
 * @param {Object} req - The request object.
 * @param {Object} req.body - The body of the request.
 * @param {string} req.body.email - The email of the user.
 * @param {string} req.body.password - The password of the user.
 * @param {Object} res - The response object.
 * @returns {void}
 */
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
        role: roleName
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Gets the profile of the authenticated user.
 *
 * @param {Object} req - The request object.
 * @param {Object} req.user - The authenticated user object attached to the request.
 * @param {string} req.user.id - The ID of the authenticated user.
 * @param {Object} res - The response object.
 * @returns {void}
 */
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
    delete user.password_hash;
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Gets all users (Admin only).
 *
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @returns {void}
 */
const getAllUsers = async (req, res) => {
  try {
    const command = new ScanCommand({
      TableName: USERS_TABLE,
      ProjectionExpression: "id, #name, email, role_id, created_at, #status",
      ExpressionAttributeNames: { "#name": "name", "#status": "status" }
    });
    
    const result = await docClient.send(command);
    res.json(result.Items);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Creates a new user (Admin only).
 *
 * @param {Object} req - The request object.
 * @param {Object} req.body - The body of the request.
 * @param {string} req.body.name - The name of the user.
 * @param {string} req.body.email - The email of the user.
 * @param {string} req.body.password - The password of the user.
 * @param {string} req.body.role - The role name of the user.
 * @param {string} [req.body.team_id] - The team ID (optional).
 * @param {string} [req.body.phone] - The phone number (optional).
 * @param {string} [req.body.designation] - The designation (optional).
 * @param {string} [req.body.status] - The status (default: 'active').
 * @param {Object} [req.body.metadata] - Additional metadata (optional).
 * @param {Object} res - The response object.
 * @returns {void}
 */
const createUser = async (req, res) => {
  const { name, email, password, role, team_id, phone, designation, status, metadata } = req.body;

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

/**
 * Refreshes the access token using the refresh token from cookies.
 *
 * @param {Object} req - The request object.
 * @param {Object} req.cookies - The cookies attached to the request.
 * @param {Object} res - The response object.
 * @returns {void}
 */
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

module.exports = { register, login, getProfile, getAllUsers, createUser, refreshToken };
