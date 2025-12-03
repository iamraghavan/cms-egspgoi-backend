const { docClient } = require('../config/db');
const { GetCommand } = require("@aws-sdk/lib-dynamodb");
const { TABLE_NAME: ROLES_TABLE } = require('../models/roleModel');

const checkPermission = (requiredPermission) => {
  return async (req, res, next) => {
    try {
      const userRole = req.user.role;
      const userRoleId = req.user.role_id;

      // Super Admin has all permissions
      if (userRole === 'Super Admin') {
        return next();
      }

      // Fetch permissions for the role from DB
      const command = new GetCommand({
        TableName: ROLES_TABLE,
        Key: { id: userRoleId }
      });
      
      const result = await docClient.send(command);
      
      if (!result.Item) {
        return res.status(403).json({ message: 'Role not found' });
      }

      const permissions = result.Item.permissions;

      // Check if user has the specific permission or "all"
      if (permissions.all || permissions[requiredPermission]) {
        return next();
      }

      return res.status(403).json({ message: 'Access denied: Insufficient permissions' });
    } catch (error) {
      console.error('RBAC Error:', error);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  };
};

module.exports = { checkPermission };
