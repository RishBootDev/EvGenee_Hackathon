const { body, query } = require('express-validator');

const addStationValidation = [
    body('name')
        .trim()
        .notEmpty().withMessage('Station name is required')
        .isLength({ min: 3, max: 100 }).withMessage('Station name must be between 3 and 100 characters'),

    body('location')
        .notEmpty().withMessage('Location is required'),

    body('location.type')
        .equals('Point').withMessage('Location type must be "Point"'),

    body('location.coordinates')
        .isArray({ min: 2, max: 2 }).withMessage('Coordinates must be an array of [longitude, latitude]'),

    body('location.coordinates.0')
        .isFloat({ min: -180, max: 180 }).withMessage('Longitude must be between -180 and 180'),

    body('location.coordinates.1')
        .isFloat({ min: -90, max: 90 }).withMessage('Latitude must be between -90 and 90'),

    body('address').notEmpty().withMessage('Address is required'),
    body('address.city').trim().notEmpty().withMessage('City is required'),
    body('address.state').trim().notEmpty().withMessage('State is required'),
    body('address.country').trim().notEmpty().withMessage('Country is required'),
    body('address.postalCode')
        .trim()
        .notEmpty().withMessage('Postal code is required')
        .matches(/^[a-zA-Z0-9\s-]+$/).withMessage('Invalid postal code format'),
    body('address.street').trim().notEmpty().withMessage('Street is required'),

    body('amenities')
        .isArray({ min: 1 }).withMessage('At least one amenity is required'),

    body('totalPorts')
        .isInt({ min: 1, max: 100 }).withMessage('Total ports must be between 1 and 100'),

    body('availablePorts')
        .isInt({ min: 0 }).withMessage('Available ports must be a non-negative integer')
        .custom((value, { req }) => {
            if (value > req.body.totalPorts) {
                throw new Error('Available ports cannot exceed total ports');
            }
            return true;
        }),

    body('chargingSpeed')
        .isFloat({ min: 1, max: 500 }).withMessage('Charging speed must be between 1 and 500 kW'),

    body('typeOfConnectors')
        .isArray({ min: 1 }).withMessage('At least one connector type is required'),

    body('typeOfConnectors.*')
        .isIn(['CCS2', 'CHAdeMO', 'Type2', 'Type1', 'Tesla']).withMessage('Invalid connector type'),

    body('pricing')
        .isArray({ min: 1 }).withMessage('At least one pricing entry is required'),

    body('pricing.*.priceperKWh')
        .isFloat({ min: 0 }).withMessage('Price per kWh must be a non-negative number'),

    body('pricing.*.connectorType')
        .notEmpty().withMessage('Connector type is required in pricing'),

    body('pricing.*.currency')
        .optional()
        .isIn(['USD', 'EUR', 'INR']).withMessage('Currency must be one of: USD, EUR, INR'),

    body('isOpen')
        .optional()
        .isBoolean().withMessage('isOpen must be a boolean'),

    body('openingHours')
        .trim()
        .notEmpty().withMessage('Opening hours are required')
        .matches(/^\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}$/).withMessage('Opening hours must be in format "HH:MM - HH:MM"'),

    body('contactInfo').notEmpty().withMessage('Contact info is required'),
    body('contactInfo.phoneNumber')
        .trim()
        .notEmpty().withMessage('Phone number is required')
        .matches(/^\+?[\d\s-]{10,15}$/).withMessage('Invalid phone number format'),
    body('contactInfo.email')
        .trim()
        .isEmail().withMessage('Invalid contact email'),

    body('operator')
        .trim()
        .notEmpty().withMessage('Operator name is required'),

    body('Images')
        .isArray({ min: 1 }).withMessage('At least one image URL is required'),

    body('Images.*')
        .isURL().withMessage('Each image must be a valid URL'),
];

const nearbyStationValidation = [
    query('lat')
        .notEmpty().withMessage('Latitude is required')
        .isFloat({ min: -90, max: 90 }).withMessage('Latitude must be between -90 and 90'),

    query('lng')
        .notEmpty().withMessage('Longitude is required')
        .isFloat({ min: -180, max: 180 }).withMessage('Longitude must be between -180 and 180'),

    query('maxDistance')
        .optional()
        .isInt({ min: 100, max: 200000 }).withMessage('Max distance must be between 100 and 200000 meters'),

    query('connectorType')
        .optional()
        .isIn(['CCS2', 'CHAdeMO', 'Type2', 'Type1', 'Tesla']).withMessage('Invalid connector type filter'),
];

const addReviewValidation = [
    body('comment')
        .trim()
        .notEmpty().withMessage('Comment is required')
        .isLength({ min: 5, max: 500 }).withMessage('Comment must be between 5 and 500 characters'),

    body('rating')
        .notEmpty().withMessage('Rating is required')
        .isFloat({ min: 0, max: 5 }).withMessage('Rating must be between 0 and 5'),
];

module.exports = {
    addStationValidation,
    nearbyStationValidation, 
    addReviewValidation,
};
