const jwt = require('jsonwebtoken');

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication token required' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
};

const roleMiddleware = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ message: 'Access denied: No role found' });
    }

    // Normalize user role: "Super Admin" -> "super_admin"
    const userRole = req.user.role.toLowerCase().replace(/\s+/g, '_');

    // Normalize allowed roles
    const normalizedAllowed = allowedRoles.map(r => r.toLowerCase().replace(/\s+/g, '_'));

    if (!normalizedAllowed.includes(userRole) && userRole !== 'super_admin') {
      return res.status(403).json({ message: 'Access denied: Insufficient privileges' });
    }
    next();
  };
};

module.exports = { authenticate, roleMiddleware };
