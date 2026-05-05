const express = require('express');
const {
    createBooking,
    checkAvailability,
    getUserBookings,
    getBookingById,
    cancelBooking,
    checkIn,
    completeBooking,
    getStationBookings,
    validateBooking,
    confirmAdvancePayment,
} = require('../controllers/booking.controller');
const { validateToken } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/authorize.middleware');
const {
    createBookingValidation,
    cancelBookingValidation,
    checkAvailabilityValidation,
} = require('../validations/booking.validation');

const { handleValidationErrors } = require('../middlewares/validate.middleware');

const router = express.Router();

router.use(validateToken);

router.post('/validate', createBookingValidation, handleValidationErrors, validateBooking);
router.post('/create', createBookingValidation, handleValidationErrors, createBooking);
router.get('/availability', checkAvailabilityValidation, handleValidationErrors, checkAvailability);
router.get('/my-bookings', getUserBookings);

router.get('/station/:stationId', authorize('StationOwner', 'admin'), getStationBookings);

router.get('/:bookingId', getBookingById);
router.post('/:bookingId/cancel', cancelBookingValidation, handleValidationErrors, cancelBooking);
router.post('/:bookingId/check-in', checkIn);
router.post('/:bookingId/complete', completeBooking);
router.post('/:bookingId/confirm-advance', confirmAdvancePayment);

module.exports = router;