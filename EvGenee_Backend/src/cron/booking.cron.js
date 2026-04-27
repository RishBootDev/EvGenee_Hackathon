const Booking = require('../models/booking.model');
const cron = require('node-cron');
const initializeCronJobs = (io) => {

    cron.schedule('*/15 * * * *', async () => {
        try {
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    
            const noShows = await Booking.updateMany(
                {
                    status: 'confirmed',
                    date: { $lte: today },
                    endTime: { $lt: currentTime },
                },
                {
                    $set: { status: 'no-show' },
                }
            );

            if (noShows.modifiedCount > 0) {
                console.log(`[CRON] Marked ${noShows.modifiedCount} bookings as no-show`);
            }
        } catch (error) {
            console.error('[CRON] Error marking no-shows:', error.message);
        }
    });

  
    cron.schedule('*/10 * * * *', async () => {
        try {
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

            const autoCompleted = await Booking.updateMany(
                {
                    status: 'in-progress',
                    date: { $lte: today },
                    endTime: { $lte: currentTime },
                },
                {
                    $set: {
                        status: 'completed',
                        completedAt: now,
                    },
                }
            );

            if (autoCompleted.modifiedCount > 0) {
                console.log(`[CRON] Auto-completed ${autoCompleted.modifiedCount} bookings`);
            
                if (io) {
                    io.emit('bookings:autoCompleted', {
                        count: autoCompleted.modifiedCount,
                        timestamp: now,
                    });
                }
            }
        } catch (error) {
            console.error('[CRON] Error auto-completing bookings:', error.message);
        }
    });

 
    cron.schedule('*/5 * * * *', async () => {
        try {
            const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

            const expired = await Booking.updateMany(
                {
                    status: 'pending',
                    createdAt: { $lt: fifteenMinutesAgo },
                },
                {
                    $set: { status: 'cancelled', cancellationReason: 'Auto-cancelled: Booking expired' },
                }
            );

            if (expired.modifiedCount > 0) {
                console.log(`[CRON] Expired ${expired.modifiedCount} pending bookings`);
            }
        } catch (error) {
            console.error('[CRON] Error expiring pending bookings:', error.message);
        }
    });

    console.log('[CRON] Booking lifecycle cron jobs initialized');
};

module.exports = { initializeCronJobs };
