const { body } = require('express-validator');

const updatePlatformSettingsValidation = [
  body('platformFee')
    .isFloat({ min: 0, max: 100 })
    .withMessage('Platform fee must be between 0 and 100'),
];

module.exports = {
  updatePlatformSettingsValidation,
};
