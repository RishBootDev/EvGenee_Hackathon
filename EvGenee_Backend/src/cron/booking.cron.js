const Booking = require('../models/booking.model');
const cron = require('node-cron');
const { sendEmail } = require('../services/email.service');
const { NODEMAILER_USER, NODEMAILER_PASS, NODEMAILER_PORT } = require('../config/config');

/**
 * Helper to get current time and date in IST (India Standard Time)
 * This ensures we match the strings stored in the database correctly.
 */
const getISTDetails = (date = new Date()) => {
    const istString = date.toLocaleString('en-US', { timeZone: 'Asia/Kolkata', hour12: false });
    // istString is "MM/DD/YYYY, HH:mm:ss"
    const [datePart, timePart] = istString.split(', ');
    const [month, day, year] = datePart.split('/');
    const [hour, minute] = timePart.split(':');
    
    const nowIST = new Date(year, month - 1, day, hour, minute);
    const todayIST = new Date(year, month - 1, day, 0, 0, 0, 0);
    const timeStrIST = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
    
    return { nowIST, todayIST, timeStrIST };
};

let lastReminderMinute = null;

const initializeCronJobs = (io) => {

    // No-show Cron: Mark bookings as no-show
    cron.schedule('*/15 * * * *', async () => {
        try {
            const { todayIST, timeStrIST } = getISTDetails();

            const noShows = await Booking.updateMany(
                {
                    status: 'confirmed',
                    date: { $lte: todayIST },
                    endTime: { $lt: timeStrIST },
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

    // Auto-complete Cron
    cron.schedule('*/10 * * * *', async () => {
        try {
            const { nowIST, todayIST, timeStrIST } = getISTDetails();

            const autoCompleted = await Booking.updateMany(
                {
                    status: 'in-progress',
                    date: { $lte: todayIST },
                    endTime: { $lte: timeStrIST },
                },
                {
                    $set: {
                        status: 'completed',
                        completedAt: nowIST,
                    },
                }
            );

            if (autoCompleted.modifiedCount > 0) {
                console.log(`[CRON] Auto-completed ${autoCompleted.modifiedCount} bookings`);
                if (io) io.emit('bookings:autoCompleted', { count: autoCompleted.modifiedCount, timestamp: nowIST });
            }
        } catch (error) {
            console.error('[CRON] Error auto-completing bookings:', error.message);
        }
    });

    // Expiration Cron (Uses createdAt, which is UTC anyway, so standard Date works)
    cron.schedule('* * * * *', async () => {
        try {
            const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
            const expired = await Booking.updateMany(
                { status: 'pending', createdAt: { $lt: tenMinutesAgo } },
                { $set: { status: 'cancelled', cancellationReason: 'Auto-cancelled: Booking expired' } }
            );
            if (expired.modifiedCount > 0) {
                console.log(`[CRON] Expired ${expired.modifiedCount} pending bookings`);
                if (io) io.emit('station:capacity_changed', { type: 'expiration', count: expired.modifiedCount, timestamp: new Date() });
            }
        } catch (error) {
            console.error('[CRON] Error expiring pending bookings:', error.message);
        }
    });

    // Reminder Cron: Find bookings starting in exactly 15 minutes IST
    cron.schedule('* * * * *', async () => {
        try {
            const { todayIST, timeStrIST: currentMinute } = getISTDetails();
            
            // Prevent duplicate execution in the same minute
            if (lastReminderMinute === currentMinute) return;
            lastReminderMinute = currentMinute;

            // Calculate time 15 minutes from now in IST
            const fifteenMinsFromNow = new Date(Date.now() + 15 * 60 * 1000);
            const { timeStrIST: reminderTimeStr } = getISTDetails(fifteenMinsFromNow);

            const upcomingBookings = await Booking.find({
                status: 'confirmed',
                date: { $eq: todayIST },
                startTime: reminderTimeStr,
                reminderSent: false
            }).populate('user', 'name email');

            for (const b of upcomingBookings) {
                try {
                    await sendEmail({
                        to: b.user.email,
                        subject: 'Session Reminder | EvGenee',
                        title: 'Almost Time to Charge',
                        content: `
                            <p>Hello <span class="highlight">${b.user.name}</span>,</p>
                            <p>Your scheduled charging session starts in <span class="highlight">15 minutes</span>. We've reserved the station for you.</p>
                            <div class="otp-box" style="text-align: left;">
                                <div style="margin-bottom: 15px;">
                                    <p style="margin: 0; color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Start Time</p>
                                    <p style="margin: 5px 0 0 0; font-weight: 700; color: #ffffff; font-size: 18px;">${b.startTime}</p>
                                </div>
                                <div>
                                    <p style="margin: 0; color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Vehicle Number</p>
                                    <p style="margin: 5px 0 0 0; font-weight: 700; color: #ffffff; font-size: 18px;">${b.vehicleNumber || 'N/A'}</p>
                                </div>
                            </div>
                            <p>Please arrive at the station a few minutes early to ensure a smooth plug-in experience.</p>
                            <p style="margin-top: 30px;">Drive safe,<br><span class="highlight">The EvGenee Team</span></p>
                        `
                    });

                    if (io) {
                        io.to(`user_${b.user._id}`).emit('booking:reminder', {
                            message: `Your charging session starts at ${b.startTime}. Be ready!`,
                            bookingId: b._id
                        });
                    }

                    console.log(`[CRON] Reminder sent to ${b.user.email} for session at ${b.startTime}`);
                    b.reminderSent = true;
                    await b.save();
                } catch (emailError) {
                    console.error(`[CRON] Failed to send reminder to ${b.user.email}:`, emailError.message);
                }
            }
        } catch (error) {
            console.error('[CRON] Error in reminder cron job:', error.message);
        }
    });
};

module.exports = { initializeCronJobs };
