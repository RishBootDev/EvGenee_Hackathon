
const initializeSocket = (io) => {
    io.on('connection', (socket) => {
        console.log(`[Socket.IO] Client connected: ${socket.id}`);

        socket.on('station:subscribe', (stationId) => {
            socket.join(`station_${stationId}`);
            console.log(`[Socket.IO] ${socket.id} subscribed to station_${stationId}`);
            socket.emit('station:subscribed', {
                stationId,
                message: `Now receiving real-time updates for station ${stationId}`,
            });
        });

        socket.on('station:unsubscribe', (stationId) => {
            socket.leave(`station_${stationId}`);
            console.log(`[Socket.IO] ${socket.id} unsubscribed from station_${stationId}`);
        });

    
        socket.on('user:subscribe', (userId) => {
            socket.join(`user_${userId}`);
            console.log(`[Socket.IO] ${socket.id} joined user room: user_${userId}`);
        });

    
        socket.on('ping', () => {
            socket.emit('pong', { timestamp: new Date().toISOString() });
        });

        
        socket.on('disconnect', (reason) => {
            console.log(`[Socket.IO] Client disconnected: ${socket.id} (${reason})`);
        });
    });

    console.log('[Socket.IO] Real-time handler initialized');
};

module.exports = { initializeSocket };
