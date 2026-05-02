const mongoose = require('mongoose');

const platformSettingsSchema = new mongoose.Schema(
  {
    platformFee: {
      type: Number,
      default: 5,
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

const PlatformSettings = mongoose.model('PlatformSettings', platformSettingsSchema);

module.exports = PlatformSettings;
