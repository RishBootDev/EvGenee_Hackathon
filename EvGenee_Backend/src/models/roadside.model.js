const mongoose = require('mongoose');

const roadsideRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    userEmail: {
      type: String,
      required: true,
    },
    userName: {
      type: String,
      required: true,
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number],
        required: true,
      },
    },
    address: {
      type: String,
      default: 'Location not specified',
    },
    issueType: {
      type: String,
      enum: ['battery_dead', 'flat_tyre', 'accident', 'breakdown', 'unknown'],
      required: true,
    },
    description: {
      type: String,
      default: '',
    },
    towRequested: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['pending', 'mechanic_assigned', 'tow_dispatched', 'en_route', 'resolved', 'cancelled'],
      default: 'pending',
    },
    mechanic: {
      name: { type: String },
      phone: { type: String },
      garage: { type: String },
      estimatedArrival: { type: String },
      distance: { type: String },
      rating: { type: Number },
      speciality: { type: String },
    },
    resolvedAt: {
      type: Date,
    },
    cancelledAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

roadsideRequestSchema.index({ location: '2dsphere' });
roadsideRequestSchema.index({ userId: 1, status: 1 });

const RoadsideRequest = mongoose.model('RoadsideRequest', roadsideRequestSchema);

module.exports = RoadsideRequest;
