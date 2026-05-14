const express = require('express');
const {
  createSosRequest,
  getNearestMechanic,
  getSosStatus,
  getMySosRequests,
  cancelSosRequest,
  getIssueTypes,
} = require('../controllers/roadside.controller');
const { validateToken } = require('../middlewares/auth.middleware');

const router = express.Router();

// Public: Get issue types for frontend dropdown
router.get('/issue-types', getIssueTypes);

// Protected: All SOS operations require authentication
router.use(validateToken);

// Find nearest mechanic preview (before submitting SOS)
router.get('/nearest-mechanic', getNearestMechanic);

// Create SOS request
router.post('/sos', createSosRequest);

// Get all SOS requests for current user
router.get('/my-requests', getMySosRequests);

// Get single SOS status
router.get('/sos/:requestId', getSosStatus);

// Cancel SOS request
router.patch('/sos/:requestId/cancel', cancelSosRequest);

module.exports = router;
