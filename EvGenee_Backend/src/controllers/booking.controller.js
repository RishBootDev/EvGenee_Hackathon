const Booking = require('../models/booking.model');
const Station = require('../models/station.model');


const timeToMinutes = (time) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};


const isOverlapping = (startA, endA, startB, endB) => {
  const sA = timeToMinutes(startA);
  const eA = timeToMinutes(endA);
  const sB = timeToMinutes(startB);
  const eB = timeToMinutes(endB);
  return sA < eB && sB < eA;
};


const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};
const createBooking = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { station: stationId, connectorType, date, startTime, endTime, vehicleNumber } = req.body;

    
    const station = await Station.findById(stationId);
    if (!station) {
      return res.status(404).json({ success: false, message: 'Station not found' });
    }
    if (!station.isOpen) {
      return res.status(400).json({ success: false, message: 'Station is currently closed' });
    }
    if (station.status !== 'active') {
      return res.status(400).json({ success: false, message: 'Station is inactive' });
    }

    
    if (!station.typeOfConnectors.includes(connectorType)) {
      return res.status(400).json({
        success: false,
        message: `This station does not support ${connectorType} connector. Available: ${station.typeOfConnectors.join(', ')}`,
      });
    }

  
    if (station.openingHours) {
      const [openTime, closeTime] = station.openingHours.split('-').map((t) => t.trim());
      const openMin = timeToMinutes(openTime);
      const closeMin = timeToMinutes(closeTime);
      const bookStartMin = timeToMinutes(startTime);
      const bookEndMin = timeToMinutes(endTime);

      if (bookStartMin < openMin || bookEndMin > closeMin) {
        return res.status(400).json({
          success: false,
          message: `Booking must be within station hours: ${station.openingHours}`,
        });
      }
    }

   
    const bookingDate = new Date(date);
    bookingDate.setHours(0, 0, 0, 0);

    const existingBookings = await Booking.find({
      station: stationId,
      date: bookingDate,
      connectorType,
      status: { $in: ['pending', 'confirmed', 'in-progress'] },
    });

    
    const requestedStart = timeToMinutes(startTime);
    const requestedEnd = timeToMinutes(endTime);

    for (let minute = requestedStart; minute < requestedEnd; minute++) {
      let concurrentCount = 0;
      for (const booking of existingBookings) {
        const bStart = timeToMinutes(booking.startTime);
        const bEnd = timeToMinutes(booking.endTime);
        if (minute >= bStart && minute < bEnd) {
          concurrentCount++;
        }
      }
      
      if (concurrentCount >= station.availablePorts) {
        const conflictHour = Math.floor(minute / 60).toString().padStart(2, '0');
        const conflictMin = (minute % 60).toString().padStart(2, '0');
        return res.status(409).json({
          success: false,
          message: `No available ports at ${conflictHour}:${conflictMin}. All ${station.availablePorts} ports are booked.`,
          suggestion: 'Try a different time slot or connector type',
        });
      }
    }

  
    const userConflict = await Booking.findOne({
      user: userId,
      date: bookingDate,
      status: { $in: ['pending', 'confirmed', 'in-progress'] },
      $or: [
        {
          $and: [
            { startTime: { $lt: endTime } },
            { endTime: { $gt: startTime } },
          ],
        },
      ],
    });

    if (userConflict) {
      return res.status(409).json({
        success: false,
        message: 'You already have an overlapping booking at this time',
        existingBooking: {
          station: userConflict.station,
          startTime: userConflict.startTime,
          endTime: userConflict.endTime,
        },
      });
    }

    
    const durationMinutes = requestedEnd - requestedStart;
    const pricing = station.pricing.find((p) => p.connectorType === connectorType);
    const pricePerKWh = pricing ? pricing.priceperKWh : 0;

  
    const durationHours = durationMinutes / 60;
    const estimatedKWh = parseFloat((station.chargingSpeed * durationHours).toFixed(2));
    const totalCost = parseFloat((estimatedKWh * pricePerKWh).toFixed(2));
    const platformFee = parseFloat(((totalCost * station.platformFee) / 100).toFixed(2));
    const grandTotal = parseFloat((totalCost + platformFee).toFixed(2));

  
    const otp = generateOtp();
    const otpExpiresAt = new Date(bookingDate);
    const [endH, endM] = endTime.split(':').map(Number);
    otpExpiresAt.setHours(endH, endM, 0, 0);

    
    const booking = await Booking.create({
      user: userId,
      station: stationId,
      connectorType,
      date: bookingDate,
      startTime,
      endTime,
      durationMinutes,
      estimatedKWh,
      totalCost,
      platformFee,
      grandTotal,
      vehicleNumber: vehicleNumber || '',
      status: 'confirmed',
      otp,
      otpExpiresAt,
    });

    
    const io = req.app.get('io');
    if (io) {
      io.to(`station_${stationId}`).emit('booking:created', {
        stationId,
        bookingId: booking._id,
        connectorType,
        startTime,
        endTime,
        date: bookingDate,
      });

      io.to(`user_${userId}`).emit('booking:created', {
        bookingId: booking._id,
        stationId,
        status: 'confirmed',
      });

      
      const updatedBookings = await Booking.countDocuments({
        station: stationId,
        date: bookingDate,
        status: { $in: ['confirmed', 'in-progress'] },
      });
      io.to(`station_${stationId}`).emit('availability:updated', {
        stationId,
        date: bookingDate,
        activeBookings: updatedBookings,
        totalPorts: station.totalPorts,
      });
    }

    res.status(201).json({
      success: true,
      message: 'Booking confirmed successfully',
      data: {
        bookingId: booking._id,
        station: station.name,
        connectorType,
        date: bookingDate.toISOString().split('T')[0],
        startTime,
        endTime,
        durationMinutes,
        estimatedKWh,
        costBreakdown: {
          chargingCost: totalCost,
          platformFee,
          grandTotal,
          currency: pricing?.currency || 'INR',
        },
        status: booking.status,
        otp: `Your check-in OTP: ${otp}`,
      },
    });
  } catch (error) {
    next(error);
  }
};

const checkAvailability = async (req, res, next) => {
  try {
    const { stationId, date, connectorType } = req.query;

    const station = await Station.findById(stationId);
    if (!station) {
      return res.status(404).json({ success: false, message: 'Station not found' });
    }

    const queryDate = new Date(date);
    queryDate.setHours(0, 0, 0, 0);

    const matchQuery = {
      station: station._id,
      date: queryDate,
      status: { $in: ['pending', 'confirmed', 'in-progress'] },
    };

    if (connectorType) {
      matchQuery.connectorType = connectorType;
    }

    const bookings = await Booking.find(matchQuery).select(
      'startTime endTime connectorType status'
    );

    
    const [openTime, closeTime] = station.openingHours
      .split('-')
      .map((t) => t.trim());
    const openMin = timeToMinutes(openTime);
    const closeMin = timeToMinutes(closeTime);

    const slots = [];
    for (let min = openMin; min < closeMin; min += 30) {
      const slotStart = `${Math.floor(min / 60).toString().padStart(2, '0')}:${(min % 60).toString().padStart(2, '0')}`;
      const slotEnd = `${Math.floor((min + 30) / 60).toString().padStart(2, '0')}:${((min + 30) % 60).toString().padStart(2, '0')}`;

      
      let overlapping = 0;
      for (const b of bookings) {
        if (isOverlapping(slotStart, slotEnd, b.startTime, b.endTime)) {
          overlapping++;
        }
      }

      slots.push({
        startTime: slotStart,
        endTime: slotEnd,
        availablePorts: Math.max(0, station.availablePorts - overlapping),
        totalPorts: station.availablePorts,
        isAvailable: overlapping < station.availablePorts,
      });
    }

    res.json({
      success: true,
      data: {
        station: station.name,
        date: queryDate.toISOString().split('T')[0],
        openingHours: station.openingHours,
        connectors: station.typeOfConnectors,
        slots,
      },
    });
  } catch (error) {
    next(error);
  }
};


const getUserBookings = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { status, page = 1, limit = 10 } = req.query;

    const query = { user: userId };
    if (status) {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [bookings, total] = await Promise.all([
      Booking.find(query)
        .populate('station', 'name address location contactInfo pricing')
        .sort({ date: -1, startTime: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Booking.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: bookings,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};


const getBookingById = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.bookingId)
      .populate('station', 'name address location contactInfo pricing openingHours')
      .populate('user', 'name email vehicle');

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    
    if (booking.user._id.toString() !== req.user.id) {
      const station = await Station.findById(booking.station._id);
      if (!station || station.ownerofStation.toString() !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    res.json({ success: true, data: booking });
  } catch (error) {
    next(error);
  }
};


const cancelBooking = async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const { reason } = req.body;

    const booking = await Booking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only cancel your own bookings',
      });
    }

    if (['cancelled', 'completed', 'in-progress'].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel a booking that is already ${booking.status}`,
      });
    }

  
    const now = new Date();
    const bookingStart = new Date(booking.date);
    const [h, m] = booking.startTime.split(':').map(Number);
    bookingStart.setHours(h, m, 0, 0);

    const timeDiffMs = bookingStart.getTime() - now.getTime();
    const hoursUntilStart = timeDiffMs / (1000 * 60 * 60);

    let refundPercentage = 100;
    if (hoursUntilStart < 1) {
      refundPercentage = 0;
    } else if (hoursUntilStart < 4) {
      refundPercentage = 50;
    }

    booking.status = 'cancelled';
    booking.cancelledAt = now;
    booking.cancellationReason = reason || 'Cancelled by user';
    await booking.save();

    
    const io = req.app.get('io');
    if (io) {
      io.to(`station_${booking.station}`).emit('booking:cancelled', {
        bookingId: booking._id,
        stationId: booking.station,
        date: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
      });

      io.to(`user_${booking.user}`).emit('booking:cancelled', {
        bookingId: booking._id,
        status: 'cancelled',
      });
    }

    res.json({
      success: true,
      message: 'Booking cancelled successfully',
      data: {
        bookingId: booking._id,
        refundPercentage,
        refundAmount: parseFloat(((booking.grandTotal * refundPercentage) / 100).toFixed(2)),
        cancellationPolicy:
          hoursUntilStart < 1
            ? 'No refund (less than 1 hour before start)'
            : hoursUntilStart < 4
              ? '50% refund (less than 4 hours before start)'
              : 'Full refund',
      },
    });
  } catch (error) {
    next(error);
  }
};

 
const checkIn = async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const { otp } = req.body;

    const booking = await Booking.findById(bookingId).select('+otp +otpExpiresAt');

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.user.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (booking.status !== 'confirmed') {
      return res.status(400).json({
        success: false,
        message: `Cannot check-in. Booking status is: ${booking.status}`,
      });
    }

    if (booking.otp !== otp) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    if (new Date() > booking.otpExpiresAt) {
      return res.status(400).json({ success: false, message: 'OTP has expired' });
    }

    booking.status = 'in-progress';
    booking.checkedInAt = new Date();
    booking.otp = undefined;
    booking.otpExpiresAt = undefined;
    await booking.save();

    
    const io = req.app.get('io');
    if (io) {
      io.to(`station_${booking.station}`).emit('booking:checkedIn', {
        bookingId: booking._id,
        stationId: booking.station,
        checkedInAt: booking.checkedInAt,
      });

      io.to(`user_${booking.user}`).emit('booking:checkedIn', {
        bookingId: booking._id,
        status: 'in-progress',
      });
    }

    res.json({
      success: true,
      message: 'Checked in successfully. Charging session started!',
      data: {
        bookingId: booking._id,
        status: booking.status,
        checkedInAt: booking.checkedInAt,
        endTime: booking.endTime,
      },
    });
  } catch (error) {
    next(error);
  }
};


const completeBooking = async (req, res, next) => {
  try {
    const { bookingId } = req.params;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }


    const station = await Station.findById(booking.station);
    const isOwner = station && station.ownerofStation.toString() === req.user.id;
    const isUser = booking.user.toString() === req.user.id;

    if (!isOwner && !isUser) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (booking.status !== 'in-progress') {
      return res.status(400).json({
        success: false,
        message: `Cannot complete. Booking status is: ${booking.status}`,
      });
    }

    booking.status = 'completed';
    booking.completedAt = new Date();
    await booking.save();

    
    const io = req.app.get('io');
    if (io) {
      io.to(`station_${booking.station}`).emit('booking:completed', {
        bookingId: booking._id,
        stationId: booking.station,
        completedAt: booking.completedAt,
      });

      io.to(`user_${booking.user}`).emit('booking:completed', {
        bookingId: booking._id,
        status: 'completed',
      });
    }

    res.json({
      success: true,
      message: 'Booking completed. Thank you for charging!',
      data: {
        bookingId: booking._id,
        status: booking.status,
        completedAt: booking.completedAt,
        grandTotal: booking.grandTotal,
      },
    });
  } catch (error) {
    next(error);
  }
};


const getStationBookings = async (req, res, next) => {
  try {
    const { stationId } = req.params;
    const { status, date, page = 1, limit = 20 } = req.query;

    const station = await Station.findById(stationId);
    if (!station) {
      return res.status(404).json({ success: false, message: 'Station not found' });
    }

    if (station.ownerofStation.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Only the station owner can view station bookings',
      });
    }

    const query = { station: stationId };
    if (status) query.status = status;
    if (date) {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      const nextDay = new Date(d);
      nextDay.setDate(nextDay.getDate() + 1);
      query.date = { $gte: d, $lt: nextDay };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [bookings, total] = await Promise.all([
      Booking.find(query)
        .populate('user', 'name email vehicle')
        .sort({ date: -1, startTime: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Booking.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: bookings,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

const validateBooking = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { station: stationId, connectorType, date, startTime, endTime } = req.body;

    const station = await Station.findById(stationId);
    if (!station) {
      return res.status(404).json({ success: false, message: 'Station not found' });
    }
    if (!station.isOpen) {
      return res.status(400).json({ success: false, message: 'Station is currently closed' });
    }
    if (station.status !== 'active') {
      return res.status(400).json({ success: false, message: 'Station is inactive' });
    }

    if (!station.typeOfConnectors.includes(connectorType)) {
      return res.status(400).json({
        success: false,
        message: `This station does not support ${connectorType} connector. Available: ${station.typeOfConnectors.join(', ')}`,
      });
    }

    if (station.openingHours) {
      const [openTime, closeTime] = station.openingHours.split('-').map((t) => t.trim());
      const openMin = timeToMinutes(openTime);
      const closeMin = timeToMinutes(closeTime);
      const bookStartMin = timeToMinutes(startTime);
      const bookEndMin = timeToMinutes(endTime);

      if (bookStartMin < openMin || bookEndMin > closeMin) {
        return res.status(400).json({
          success: false,
          message: `Booking must be within station hours: ${station.openingHours}`,
        });
      }
    }

    const bookingDate = new Date(date);
    bookingDate.setHours(0, 0, 0, 0);

    const existingBookings = await Booking.find({
      station: stationId,
      date: bookingDate,
      connectorType,
      status: { $in: ['pending', 'confirmed', 'in-progress'] },
    });

    const requestedStart = timeToMinutes(startTime);
    const requestedEnd = timeToMinutes(endTime);

    for (let minute = requestedStart; minute < requestedEnd; minute++) {
      let concurrentCount = 0;
      for (const booking of existingBookings) {
        const bStart = timeToMinutes(booking.startTime);
        const bEnd = timeToMinutes(booking.endTime);
        if (minute >= bStart && minute < bEnd) {
          concurrentCount++;
        }
      }
      
      if (concurrentCount >= station.availablePorts) {
        const conflictHour = Math.floor(minute / 60).toString().padStart(2, '0');
        const conflictMin = (minute % 60).toString().padStart(2, '0');
        return res.status(409).json({
          success: false,
          message: `No available ports at ${conflictHour}:${conflictMin}. All ${station.availablePorts} ports are booked.`,
          suggestion: 'Try a different time slot or connector type',
        });
      }
    }

    const userConflict = await Booking.findOne({
      user: userId,
      date: bookingDate,
      status: { $in: ['pending', 'confirmed', 'in-progress'] },
      $or: [
        {
          $and: [
            { startTime: { $lt: endTime } },
            { endTime: { $gt: startTime } },
          ],
        },
      ],
    });

    if (userConflict) {
      return res.status(409).json({
        success: false,
        message: 'You already have an overlapping booking at this time',
        existingBooking: {
          station: userConflict.station,
          startTime: userConflict.startTime,
          endTime: userConflict.endTime,
        },
      });
    }

    res.status(200).json({
      success: true,
      message: 'Slot is available and valid',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createBooking,
  validateBooking,
  checkAvailability,
  getUserBookings,
  getBookingById,
  cancelBooking,
  checkIn,
  completeBooking,
  getStationBookings,
};