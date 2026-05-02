const express = require('express');
const {
    addStation,
    getNearbyStations,
    getStationById,
    updateStation,
    toggleStationStatus,
    addReview,
    getMyStations,
    getAllStations,
    deleteStation,
    updateStationStatus,
    suspendStationOwner,
    getStationByOwner,
} = require('../controllers/station.controller');
const { validateToken } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/authorize.middleware');
const {
    addStationValidation,
    nearbyStationValidation,
    addReviewValidation,
} = require('../validations/station.validation');
const { handleValidationErrors } = require('../middlewares/validate.middleware');

const router = express.Router();

// ===== PUBLIC ROUTES =====
router.get('/nearby', nearbyStationValidation, handleValidationErrors, getNearbyStations);

// ===== ADMIN ROUTES (defined before generic :stationId routes) =====
// Get all stations with filters
router.get(
    '/admin/all-stations',
    validateToken,
    authorize('admin'),
    getAllStations
);

// Get stations by owner
router.get(
    '/admin/owner/:ownerId',
    validateToken,
    authorize('admin'),
    getStationByOwner
);

// Update station status (admin only)
router.put(
    '/admin/:stationId/status',
    validateToken,
    authorize('admin'),
    updateStationStatus
);

// Suspend station (admin only)
router.put(
    '/admin/:stationId/suspend',
    validateToken,
    authorize('admin'),
    suspendStationOwner
);

// Delete station (admin only)
router.delete(
    '/admin/:stationId',
    validateToken,
    authorize('admin'),
    deleteStation
);

// ===== OWNER ROUTES =====
router.post(
    '/add',
    validateToken,
    authorize('StationOwner', 'admin'),
    addStationValidation,
    handleValidationErrors,
    addStation
);

router.get(
    '/owner/my-stations',
    validateToken,
    authorize('StationOwner', 'admin'),
    getMyStations
);

// ===== GENERIC ROUTES =====
router.get('/:stationId', getStationById);

router.post('/:stationId/review', validateToken, addReviewValidation, handleValidationErrors, addReview);

router.put(
    '/:stationId',
    validateToken,
    authorize('StationOwner', 'admin'),
    updateStation
);

router.patch(
    '/:stationId/toggle',
    validateToken,
    authorize('StationOwner', 'admin'),
    toggleStationStatus
);

module.exports = router;