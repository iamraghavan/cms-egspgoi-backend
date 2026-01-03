const app = require('../server');
const { initSocket } = require('../src/services/socketService');

module.exports = (req, res) => {
    // Vercel Serverless Hack: Attach Socket.io to the underlying HTTP server
    if (res.socket && res.socket.server) {
        if (!res.socket.server.io) {
            console.log('Initializing Socket.io on Vercel...');
            const io = initSocket(res.socket.server);
            res.socket.server.io = io;
        }
    }

    // Pass request to Express app
    app(req, res);
};
