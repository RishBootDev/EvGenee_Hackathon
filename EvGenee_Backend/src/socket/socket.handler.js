const { processVoiceChat } = require('../services/langgraph.service');

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

       
        socket.on('ai:voice_chat', async (data) => {
            try {
                const { message, threadId } = data;
                console.log(`[Socket.IO] AI Chat request from ${socket.id}`);
                const response = await processVoiceChat(message, threadId || socket.id);
                socket.emit('ai:voice_response', { success: true, response, threadId: threadId || socket.id });
            } catch (error) {
                console.error("[Socket.IO] AI Chat error:", error);
                socket.emit('ai:voice_response', { success: false, error: "Failed to process chat" });
            }
        });

        
        socket.on('disconnect', (reason) => {
            console.log(`[Socket.IO] Client disconnected: ${socket.id} (${reason})`);
        });
    });

    console.log('[Socket.IO] Real-time handler initialized');
};

module.exports = { initializeSocket };
