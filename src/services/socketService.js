const socketIo = require('socket.io');
const { verifyAccessToken } = require('../utils/jwtUtils');

let io;

/**
 * Initialize Socket.io
 * @param {Object} server - HTTP Server instance
 */
const initSocket = (server) => {
    // Configure CORS for Socket.io matching the Express CORS
    io = socketIo(server, {
        cors: {
            origin: true, // Allow all or match config.frontendUrl
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
