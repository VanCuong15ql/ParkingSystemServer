const { Server } = require('socket.io');

let io;

const initializeSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: process.env.CLIENT_URL || 'http://localhost:3000',
            methods: ['GET', 'POST'],
        },
    });

    io.on('connection', (socket) => {
        console.log('Client connected:', socket.id);

        socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.id);
        });

        // Join user-specific room for targeted updates
        socket.on('join-user-room', (userId) => {
            socket.join(`user-${userId}`);
            console.log(`Socket ${socket.id} joined room user-${userId}`);
        });
    });

    return io;
};

const getIO = () => {
    if (!io) {
        throw new Error('Socket.io not initialized');
    }
    return io;
};

// Emit intersection slots update to specific user
const emitIntersectionSlotsUpdate = (userId, data) => {
    const ioInstance = getIO();
    console.log('[socket.js] Emitting to room:', `user-${userId}`);
    console.log('[socket.js] Data:', data);
    ioInstance.to(`user-${userId}`).emit('intersectionSlotsUpdated', data);
    console.log(`[socket.js] Emitted intersectionSlotsUpdated to user-${userId}`);
};

// Emit parking spaces update to specific user
const emitParkingSpacesUpdate = (userId, data) => {
    const ioInstance = getIO();
    console.log('[socket.js] Emitting parkingSpacesUpdate to room:', `user-${userId}`);
    console.log('[socket.js] Data:', data);
    ioInstance.to(`user-${userId}`).emit('parkingSpacesUpdated', data);
    console.log(`[socket.js] Emitted parkingSpacesUpdated to user-${userId}`);
};

module.exports = {
    initializeSocket,
    getIO,
    emitIntersectionSlotsUpdate,
    emitParkingSpacesUpdate,
};
