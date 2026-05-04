const PlatformSettings = require('../models/platformSettings.model');

const getPlatformSettings = async (req, res, next) => {
  try {
    let settings = await PlatformSettings.findOne();
    
    if (!settings) {
      settings = await PlatformSettings.create({
        platformFee: 5,
        updatedBy: req.user?._id || null,
      });
    }

    res.status(200).json({
      success: true,
      message: 'Platform settings retrieved successfully',
      data: settings,
    });
  } catch (error) {
    next(error);
  }
};

const updatePlatformSettings = async (req, res, next) => {
  try {
    const { platformFee } = req.body;

    let settings = await PlatformSettings.findOne();

    if (!settings) {
      settings = await PlatformSettings.create({
        platformFee,
        updatedBy: req.user._id,
      });
    } else {
      settings.platformFee = platformFee;
      settings.updatedBy = req.user._id;
      settings = await settings.save();
    }

    res.status(200).json({
      success: true,
      message: 'Platform settings updated successfully',
      data: settings,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPlatformSettings,
  updatePlatformSettings,
};
