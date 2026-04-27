const express = require('express');
const {
    registerUser,
    loginUser,
    getProfile,
    updateProfile,
    logoutUser,
} = require('../controllers/user.controller');
const { registerValidation, loginValidation } = require('../validations/user.validation');
const { handleValidationErrors } = require('../middlewares/validate.middleware');
const { validateToken } = require('../middlewares/auth.middleware');

const router = express.Router();

// Public routes
router.post('/register', registerValidation, handleValidationErrors, registerUser);
router.post('/login', loginValidation, handleValidationErrors, loginUser);

// Protected routes
router.get('/profile', validateToken, getProfile);
router.put('/profile', validateToken, updateProfile);
router.post('/logout', validateToken, logoutUser);

module.exports = router;