const RoadsideRequest = require('../models/roadside.model');
const { sendEmail } = require('../services/email.service');

// ─── Mock Mechanic Pool ────────────────────────────────────────────────────────
// Realistic mechanic data keyed by city/region — works perfectly for demo
const MOCK_MECHANICS = {
  delhi: [
    {
      name: 'Kapil EV Rescue',
      phone: '+91-9811234567',
      garage: 'Kapil Auto Services, Connaught Place',
      rating: 4.8,
      speciality: 'EV Battery & Drivetrain',
    },
    {
      name: 'Delhi EV Care Hub',
      phone: '+91-9911223344',
      garage: 'EV Care Hub, Dwarka Sector 12',
      rating: 4.6,
      speciality: 'EV Charging & Breakdown',
    },
  ],
  mumbai: [
    {
      name: 'Shankar EV Workshop',
      phone: '+91-9820012345',
      garage: 'Shankar Motors, Andheri West',
      rating: 4.9,
      speciality: 'Full EV Diagnostics',
    },
    {
      name: 'Mumbai Quick EV Fix',
      phone: '+91-9819876543',
      garage: 'QuickFix Garage, Bandra',
      rating: 4.5,
      speciality: 'Towing & Recovery',
    },
  ],
  bangalore: [
    {
      name: 'TechServe EV Solutions',
      phone: '+91-9845012345',
      garage: 'TechServe, Koramangala',
      rating: 4.9,
      speciality: 'Software & EV Battery',
    },
    {
      name: 'Namma EV Rescue',
      phone: '+91-9844556677',
      garage: 'Namma Garage, Whitefield',
      rating: 4.7,
      speciality: 'Emergency Towing',
    },
  ],
  hyderabad: [
    {
      name: 'HiTech EV Assist',
      phone: '+91-9848012345',
      garage: 'HiTech Motors, HITEC City',
      rating: 4.7,
      speciality: 'EV Breakdown & Recovery',
    },
  ],
  pune: [
    {
      name: 'Pune EV Garage',
      phone: '+91-9881234567',
      garage: 'Pune EV Centre, Hinjewadi',
      rating: 4.6,
      speciality: 'Battery & Tyre Services',
    },
  ],
  chennai: [
    {
      name: 'Chennai EV Masters',
      phone: '+91-9841234567',
      garage: 'EV Masters, Anna Nagar',
      rating: 4.8,
      speciality: 'Full EV Servicing',
    },
  ],
  default: [
    {
      name: 'EvGenee Emergency Team',
      phone: '+91-9000000001',
      garage: 'EvGenee Central Dispatch',
      rating: 5.0,
      speciality: 'EV Emergency Dispatch & Towing',
    },
  ],
};

// ─── Issue Labels ──────────────────────────────────────────────────────────────
const ISSUE_LABELS = {
  battery_dead: ' Battery Dead / Won\'t Start',
  flat_tyre: 'Flat Tyre',
  accident: ' Minor Accident / Damage',
  breakdown: ' Engine / Mechanical Breakdown',
  unknown: ' Unknown Issue — Tow Truck Dispatched',
};

// ─── Helper: Derive City From Coordinates (basic India bounding boxes) ─────────
function deriveCityFromCoordinates(lat, lng) {
  const cities = [
    { name: 'delhi',     latMin: 28.4, latMax: 28.9, lngMin: 76.8, lngMax: 77.5 },
    { name: 'mumbai',    latMin: 18.8, latMax: 19.3, lngMin: 72.7, lngMax: 73.1 },
    { name: 'bangalore', latMin: 12.8, latMax: 13.2, lngMin: 77.4, lngMax: 77.8 },
    { name: 'hyderabad', latMin: 17.2, latMax: 17.6, lngMin: 78.2, lngMax: 78.7 },
    { name: 'pune',      latMin: 18.4, latMax: 18.7, lngMin: 73.7, lngMax: 74.0 },
    { name: 'chennai',   latMin: 12.9, latMax: 13.2, lngMin: 80.1, lngMax: 80.4 },
  ];

  for (const city of cities) {
    if (lat >= city.latMin && lat <= city.latMax && lng >= city.lngMin && lng <= city.lngMax) {
      return city.name;
    }
  }
  return 'default';
}

// ─── Helper: Pick random mechanic from pool + simulate ETA ────────────────────
function assignMechanic(lat, lng) {
  const city = deriveCityFromCoordinates(lat, lng);
  const pool = MOCK_MECHANICS[city] || MOCK_MECHANICS.default;
  const mechanic = pool[Math.floor(Math.random() * pool.length)];

  // Simulate ETA: 10–30 minutes based on random factor
  const etaMin = Math.floor(Math.random() * 12) + 10;
  const etaMax = etaMin + 8;
  const distance = (Math.random() * 6 + 1.5).toFixed(1);

  return {
    ...mechanic,
    estimatedArrival: `${etaMin}–${etaMax} minutes`,
    distance: `${distance} km`,
    city,
  };
}

// ─── Helper: Build Google Maps deep-link ──────────────────────────────────────
function buildMapsLink(lat, lng) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

// ══════════════════════════════════════════════════════════════════════════════
// CONTROLLER: Create SOS Request
// POST /api/v1/roadside/sos
// ══════════════════════════════════════════════════════════════════════════════
const createSosRequest = async (req, res, next) => {
  try {
    const { latitude, longitude, address, issueType, description, requestTow } = req.body;

    // Validate required fields
    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Location (latitude & longitude) is required to dispatch help.',
      });
    }

    if (!issueType) {
      return res.status(400).json({
        success: false,
        message: 'Please select an issue type or choose "Not Sure" to request a tow truck.',
      });
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    const isTow = requestTow === true || requestTow === 'true' || issueType === 'unknown';

    // Assign nearest mechanic
    const mechanicData = assignMechanic(lat, lng);
    const mapsLink = buildMapsLink(lat, lng);

    // Create the SOS document
    const sosRequest = await RoadsideRequest.create({
      userId: req.user.id,
      userEmail: req.user.email,
      userName: req.user.name,
      location: {
        type: 'Point',
        coordinates: [lng, lat], // GeoJSON: [lng, lat]
      },
      address: address || 'Location shared via GPS',
      issueType,
      description: description || '',
      towRequested: isTow,
      status: isTow ? 'tow_dispatched' : 'mechanic_assigned',
      mechanic: {
        name: mechanicData.name,
        phone: mechanicData.phone,
        garage: mechanicData.garage,
        estimatedArrival: mechanicData.estimatedArrival,
        distance: mechanicData.distance,
        rating: mechanicData.rating,
        speciality: mechanicData.speciality,
      },
    });

    // ── Send confirmation email to user ─────────────────────────────────────
    try {
      await sendEmail({
        to: req.user.email,
        subject: isTow
          ? '🚛 Tow Truck Dispatched | EvGenee SOS'
          : '🔧 Mechanic On The Way | EvGenee SOS',
        title: isTow ? 'Tow Truck Has Been Dispatched' : 'Help Is On The Way!',
        content: `
          <p>Hi <strong>${req.user.name}</strong>,</p>
          <p>We've received your SOS request and immediately dispatched help to your location.</p>
          
          <div class="otp-box" style="text-align:left; padding: 24px;">
            <p style="color: #94a3b8; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 16px;">
              ${isTow ? '🚛 TOW TRUCK DETAILS' : '🔧 MECHANIC DETAILS'}
            </p>
            <p style="margin: 6px 0;"><span class="highlight">Name:</span> ${mechanicData.name}</p>
            <p style="margin: 6px 0;"><span class="highlight">Phone:</span> ${mechanicData.phone}</p>
            <p style="margin: 6px 0;"><span class="highlight">Garage:</span> ${mechanicData.garage}</p>
            <p style="margin: 6px 0;"><span class="highlight">Rating:</span> ${'⭐'.repeat(Math.round(mechanicData.rating))} (${mechanicData.rating}/5)</p>
            <p style="margin: 6px 0;"><span class="highlight">Speciality:</span> ${mechanicData.speciality}</p>
            <p style="margin: 6px 0;"><span class="highlight">Distance:</span> ${mechanicData.distance} away</p>
            <p style="margin: 6px 0;"><span class="highlight">ETA:</span> ${mechanicData.estimatedArrival}</p>
          </div>

          <div style="margin: 24px 0;">
            <p style="color: #94a3b8;"><span class="highlight">Issue Reported:</span> ${ISSUE_LABELS[issueType] || issueType}</p>
            ${description ? `<p style="color: #94a3b8;"><span class="highlight">Your Note:</span> ${description}</p>` : ''}
            <p style="color: #94a3b8;"><span class="highlight">Your Location:</span> ${address || 'Shared via GPS'}</p>
          </div>

          <a href="${mapsLink}" class="btn" style="margin-top:8px;">📍 View Your Location</a>

          <p style="margin-top: 30px; color: #94a3b8;">
            Please stay safe, stay in your vehicle if possible, and keep your phone accessible.<br>
            Your SOS ID: <span class="highlight">${sosRequest._id}</span>
          </p>
          <p style="margin-top: 16px;">Stay safe,<br><span class="highlight">EvGenee Emergency Response Team</span></p>
        `,
      });
    } catch (emailError) {
      // Email failure should not block the SOS response
      console.error('[Roadside] Email notification failed:', emailError.message);
    }

    console.log(`[Roadside] SOS created: ${sosRequest._id} for user ${req.user.email} | Issue: ${issueType} | Tow: ${isTow}`);

    return res.status(201).json({
      success: true,
      message: isTow
        ? 'Tow truck has been dispatched to your location!'
        : 'Mechanic has been dispatched to your location!',
      data: {
        requestId: sosRequest._id,
        status: sosRequest.status,
        issueType: sosRequest.issueType,
        issueLabel: ISSUE_LABELS[issueType] || issueType,
        towRequested: isTow,
        address: sosRequest.address,
        mechanic: sosRequest.mechanic,
        createdAt: sosRequest.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// CONTROLLER: Get Nearest Mechanic (preview before committing SOS)
// GET /api/v1/roadside/nearest-mechanic?lat=xx&lng=xx
// ══════════════════════════════════════════════════════════════════════════════
const getNearestMechanic = async (req, res, next) => {
  try {
    const { lat, lng } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required as query params.',
      });
    }

    const mechanicData = assignMechanic(parseFloat(lat), parseFloat(lng));

    return res.json({
      success: true,
      message: 'Nearest mechanic found',
      data: {
        name: mechanicData.name,
        phone: mechanicData.phone,
        garage: mechanicData.garage,
        rating: mechanicData.rating,
        speciality: mechanicData.speciality,
        estimatedArrival: mechanicData.estimatedArrival,
        distance: mechanicData.distance,
        city: mechanicData.city,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// CONTROLLER: Get SOS Status
// GET /api/v1/roadside/sos/:requestId
// ══════════════════════════════════════════════════════════════════════════════
const getSosStatus = async (req, res, next) => {
  try {
    const { requestId } = req.params;

    const sosRequest = await RoadsideRequest.findById(requestId);

    if (!sosRequest) {
      return res.status(404).json({
        success: false,
        message: 'SOS request not found.',
      });
    }

    // Ensure users can only see their own requests
    if (sosRequest.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to view this SOS request.',
      });
    }

    return res.json({
      success: true,
      data: {
        requestId: sosRequest._id,
        status: sosRequest.status,
        issueType: sosRequest.issueType,
        issueLabel: ISSUE_LABELS[sosRequest.issueType] || sosRequest.issueType,
        towRequested: sosRequest.towRequested,
        address: sosRequest.address,
        description: sosRequest.description,
        mechanic: sosRequest.mechanic,
        createdAt: sosRequest.createdAt,
        resolvedAt: sosRequest.resolvedAt,
        cancelledAt: sosRequest.cancelledAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// CONTROLLER: Get All SOS Requests for Current User
// GET /api/v1/roadside/my-requests
// ══════════════════════════════════════════════════════════════════════════════
const getMySosRequests = async (req, res, next) => {
  try {
    const requests = await RoadsideRequest.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(20);

    return res.json({
      success: true,
      data: requests.map((r) => ({
        requestId: r._id,
        status: r.status,
        issueType: r.issueType,
        issueLabel: ISSUE_LABELS[r.issueType] || r.issueType,
        towRequested: r.towRequested,
        address: r.address,
        mechanic: r.mechanic,
        createdAt: r.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// CONTROLLER: Cancel SOS Request
// PATCH /api/v1/roadside/sos/:requestId/cancel
// ══════════════════════════════════════════════════════════════════════════════
const cancelSosRequest = async (req, res, next) => {
  try {
    const { requestId } = req.params;

    const sosRequest = await RoadsideRequest.findById(requestId);

    if (!sosRequest) {
      return res.status(404).json({
        success: false,
        message: 'SOS request not found.',
      });
    }

    if (sosRequest.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to cancel this SOS request.',
      });
    }

    if (sosRequest.status === 'resolved') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel a resolved request.',
      });
    }

    if (sosRequest.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'This SOS request is already cancelled.',
      });
    }

    sosRequest.status = 'cancelled';
    sosRequest.cancelledAt = new Date();
    await sosRequest.save();

    console.log(`[Roadside] SOS cancelled: ${sosRequest._id} by user ${req.user.email}`);

    return res.json({
      success: true,
      message: 'SOS request cancelled successfully.',
      data: {
        requestId: sosRequest._id,
        status: sosRequest.status,
        cancelledAt: sosRequest.cancelledAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// CONTROLLER: Get All Issue Types (for frontend dropdown)
// GET /api/v1/roadside/issue-types   (public)
// ══════════════════════════════════════════════════════════════════════════════
const getIssueTypes = async (req, res) => {
  const types = Object.entries(ISSUE_LABELS).map(([value, label]) => ({
    value,
    label,
  }));
  return res.json({ success: true, data: types });
};

module.exports = {
  createSosRequest,
  getNearestMechanic,
  getSosStatus,
  getMySosRequests,
  cancelSosRequest,
  getIssueTypes,
};
