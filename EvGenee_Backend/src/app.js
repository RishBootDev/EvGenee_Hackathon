const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { errorHandler } = require('./middlewares/error.middleware');

const stationRoutes = require('./routes/station.routes');
const bookingRoutes = require('./routes/booking.routes');
const userRoutes = require('./routes/user.routes');

const app = express();


app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());


app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
    next();
});

app.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'EV Charging API is running',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});


app.use('/api/v1/users', userRoutes);
app.use('/api/v1/stations', stationRoutes);
app.use('/api/v1/bookings', bookingRoutes);

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route not found: ${req.method} ${req.originalUrl}`,
    });
});


app.use(errorHandler);

module.exports = app;