const http = require('http');
const { Server } = require('socket.io');
const app = require('./src/app');
const { PORT } = require('./src/config/config');
const Connectdb = require('./src/config/db');
const { initializeSocket } = require('./src/socket/socket.handler');
const { initializeCronJobs } = require('./src/cron/booking.cron');
const PlatformSettings = require('./src/models/platformSettings.model');

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
});


app.set('io', io);

initializeSocket(io);

Connectdb()
    .then(async () => {
       
        const existingSettings = await PlatformSettings.findOne();
        if (!existingSettings) {
            await PlatformSettings.create({
                platformFee: 5,
                updatedBy: null,
            });
            console.log('Platform settings initialized with default 5% fee');
        }

        server.listen(PORT, () => {
            console.log(`\n EV Charging Server running on port ${PORT}`);

        });

       
        initializeCronJobs(io);
    })
    .catch((err) => {
        console.error('Failed to connect to database:', err.message);
        process.exit(1);
    });
