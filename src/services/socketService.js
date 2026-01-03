const socketIo = require('socket.io');
const { verifyAccessToken } = require('../utils/jwtUtils');

let io;

/**
 * Initialize Socket.io
 * @param {Object} server - HTTP Server instance
 */
const initSocket = (server) => {
    if (io) {
        console.log("Socket.io already initialized!");
        return io;
    }

    // Configure CORS and Path for Vercel
    // We add /api/socket.io as the path because Vercel rewrites usually go to /api/...
    // But since the user has a catch-all rewrite to /api/index.js, default /socket.io might work IF the server intercepts it.
    // To be safe and explicit for Vercel, we often use a custom path or rely on the rewrite.
    // Given the user's "routes": [{"src": "/(.*)", "dest": "/api/index.js"}], 
    // any request to /socket.io/... hits api/index.js.

    io = socketIo(server, {
        path: '/socket.io', // Standard path, but handled by the one server instance
        transports: ['polling'], // Force polling for serverless stability
        addTrailingSlash: false,
        cors: {
            origin: "*", // Allow all for now to avoid CORS headaches on Vercel
            methods: ["GET", "POST"],
            credentials: true
        }
    });

    // Middleware for Auth
    io.use((socket, next) => {
        const token = socket.handshake.auth.token || socket.handshake.query.token;
        if (!token) {
            return next(new Error('Authentication error'));
        }
        try {
            const decoded = verifyAccessToken(token);
            socket.user = decoded; // Attach user info to socket
            next();
        } catch (err) {
            next(new Error('Authentication error'));
        }
    });

    io.on('connection', (socket) => {
        console.log(`Socket connected: ${socket.id} (User: ${socket.user.name}, Role: ${socket.user.role_name})`);

        // Join room based on User ID for personal notifications
        socket.join(socket.user.id);

        // Join room based on Role for broad notifications (e.g. "Admission Manager")
        if (socket.user.role_name) {
            socket.join(socket.user.role_name);
        }

        socket.on('disconnect', () => {
            console.log(`Socket disconnected: ${socket.id}`);
        });
    });

    return io;
};

/**
 * Get IO Instance
 */
const getIO = () => {
    if (!io) {
        throw new Error("Socket.io not initialized!");
    }
    return io;
};

/**
 * Emit event to a specific user
 * @param {string} userId 
 * @param {string} event 
 * @param {object} data 
 */
const emitToUser = (userId, event, data) => {
    if (io) {
        io.to(userId).emit(event, data);
    }
};

/**
 * Emit event to a specific role
 * @param {string} roleName 
 * @param {string} event 
 * @param {object} data 
 */
const emitToRole = (roleName, event, data) => {
    if (io) {
        io.to(roleName).emit(event, data);
    }
};

module.exports = { initSocket, getIO, emitToUser, emitToRole };
