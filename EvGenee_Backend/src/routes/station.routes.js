const express = require('express');
const {
    addStation,
    getNearbyStations,
    getStationById,
    updateStation,
    toggleStationStatus,
    addReview,
    getMyStations,
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

router.get('/nearby', nearbyStationValidation, handleValidationErrors, getNearbyStations);

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