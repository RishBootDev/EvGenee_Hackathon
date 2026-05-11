const User = require('../models/user.model');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_KEY } = require('../config/config');
const { sendEmail } = require('../services/email.service');
const crypto = require('crypto');

const registerUser = async (req, res, next) => {
  try {
    const { name, email, password, role, vehicle, vehicleNumbers } = req.body;

  
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists',
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const userData = {
      name,
      email,
      password: hashedPassword,
      role: role || 'user',
    };

    if (vehicle) {
      userData.vehicle = vehicle;
    }
    if (vehicleNumbers) {
      userData.vehicleNumbers = vehicleNumbers;
    }

    const user = await User.create(userData);

    const token = jwt.sign(
      { id: user._id, role: user.role, name: user.name, email: user.email },
      JWT_KEY,
      { expiresIn: '7d' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, 
    });

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        vehicle: user.vehicle,
        vehicleNumbers: user.vehicleNumbers ?? [],
        savedVehicles: user.savedVehicles ?? [],
        createdAt: user.createdAt,
      },
      token,
    });
  } catch (error) {
    next(error);
  }
};

const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role, name: user.name, email: user.email },
      JWT_KEY,
      { expiresIn: '7d' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        vehicle: user.vehicle,
        vehicleNumbers: user.vehicleNumbers ?? [],
        savedVehicles: user.savedVehicles ?? [],
        createdAt: user.createdAt,
      },
      token,
    });
  } catch (error) {
    next(error);
  }
};

const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const { name, vehicle, vehicleNumbers, savedVehicles } = req.body;
    
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (name) user.name = name;
    if (vehicle) user.vehicle = vehicle;
    
    if (Array.isArray(vehicleNumbers)) {
      user.vehicleNumbers = vehicleNumbers;
      user.markModified('vehicleNumbers');
    }

    if (Array.isArray(savedVehicles)) {
      console.log(`[Profile] Syncing ${savedVehicles.length} vehicles for user ${user._id}`);
      user.set('savedVehicles', savedVehicles);
    }

    try {
      const updatedUser = await user.save();
      console.log(`[Profile] Successfully persisted ${updatedUser.savedVehicles.length} vehicles to DB.`);
      
      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: updatedUser,
      });
    } catch (saveError) {
      console.error(`[Profile] Save failed:`, saveError.message);
      res.status(500).json({
        success: false,
        message: 'Failed to save profile: ' + saveError.message
      });
    }
  } catch (error) {
    next(error);
  }
};

const logoutUser = async (req, res) => {
  res.clearCookie('token');
  res.json({
    success: true,
    message: 'Logged out successfully',
  });
};

const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this email address',
      });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    user.resetPasswordOTP = otp;
    user.resetPasswordExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    await user.save();

    await sendEmail({
      to: email,
      subject: 'Access Code | EvGenee',
      title: 'Verify Your Identity',
      content: `
        <p>Hello,</p>
        <p>Your security is our priority. Please use the <span class="highlight">Access Code</span> below to complete your sign-in to <span class="highlight">EvGenee</span>.</p>
        <div class="otp-box">
          <p style="color: #94a3b8; font-size: 14px; margin-bottom: 10px;">ONE-TIME ACCESS CODE</p>
          <h3 class="otp-code">${otp}</h3>
        </div>
        <p>This code will expire in <span class="highlight">10 minutes</span>. If you did not request this, please secure your account immediately.</p>
        <p style="margin-top: 30px;">Best regards,<br><span class="highlight">The EvGenee Security Team</span></p>
      `
    });

    res.json({
      success: true,
      message: 'OTP sent to your email address',
    });
  } catch (error) {
    next(error);
  }
};

const verifyOTP = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    
    const user = await User.findOne({ 
      email,
      resetPasswordOTP: otp,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP',
      });
    }

    res.json({
      success: true,
      message: 'OTP verified successfully',
    });
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { email, otp, password } = req.body;

    const user = await User.findOne({ 
      email,
      resetPasswordOTP: otp,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP session',
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 12);
    user.password = hashedPassword;
    
    // Clear OTP fields
    user.resetPasswordOTP = undefined;
    user.resetPasswordExpires = undefined;
    
    await user.save();

    res.json({
      success: true,
      message: 'Password reset successful. You can now login with your new password.',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  registerUser,
  loginUser,
  getProfile,
  updateProfile,
  logoutUser,
  forgotPassword,
  verifyOTP,
  resetPassword,
};