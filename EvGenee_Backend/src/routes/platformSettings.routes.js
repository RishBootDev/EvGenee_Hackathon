const express = require('express');
const { validateToken } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/authorize.middleware');
const { getPlatformSettings, updatePlatformSettings } = require('../controllers/platformSettings.controller');
const { updatePlatformSettingsValidation } = require('../validations/platformSettings.validation');

const router = express.Router();

router.get('/', getPlatformSettings);

router.put(
  '/',
  validateToken,
  authorize('admin'),
  updatePlatformSettingsValidation,
  updatePlatformSettings
);

module.exports = router;
