  const Station = require('../models/station.model');

const addStation = async (req, res, next) => {
  try {
    
    req.body.ownerofStation = req.user.id;

    const station = await Station.create(req.body);
    res.status(201).json({
      success: true,
      message: 'Station created successfully',
      data: station,
    });
  } catch (error) {
    next(error);
  }
};

const getNearbyStations = async (req, res, next) => {
  try {
    const { lat, lng, maxDistance = 500000000, connectorType } = req.query;

    const pipeline = [
      {
        $geoNear: {
          near: {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)],
          },
          distanceField: 'distance',
          spherical: true,
          maxDistance: parseInt(maxDistance),
        },
      },
    ];

  
    if (connectorType) {
      pipeline.push({
        $match: { typeOfConnectors: connectorType },
      });
    }

    
    pipeline.push({
      $match: { status: 'active', isOpen: true },
    });

    
    pipeline.push({
      $addFields: {
        distanceKm: { $round: [{ $divide: ['$distance', 1000] }, 2] },
      },
    });

    
    pipeline.push({ $sort: { distance: 1 } });

    const stations = await Station.aggregate(pipeline);

    res.json({
      success: true,
      count: stations.length,
      data: stations,
    });
  } catch (error) {
    next(error);
  }
};

const getStationById = async (req, res, next) => {
  try {
    const station = await Station.findById(req.params.stationId).populate(
      'ownerofStation',
      'name email'
    );

    if (!station) {
      return res.status(404).json({
        success: false,
        message: 'Station not found',
      });
    }

    res.json({
      success: true,
      data: station,
    });
  } catch (error) {
    next(error);
  }
};

const updateStation = async (req, res, next) => {
  try {
    const station = await Station.findById(req.params.stationId);

    if (!station) {
      return res.status(404).json({
        success: false,
        message: 'Station not found',
      });
    }

 
    if (station.ownerofStation.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to update this station',
      });
    }

    const updatedStation = await Station.findByIdAndUpdate(
      req.params.stationId,
      req.body,
      { new: true, runValidators: true }
    );

    
    const io = req.app.get('io');
    if (io) {
      io.to(`station_${req.params.stationId}`).emit('station:updated', {
        stationId: req.params.stationId,
        updates: req.body,
        updatedAt: new Date(),
      });
    }

    res.json({
      success: true,
      message: 'Station updated successfully',
      data: updatedStation,
    });
  } catch (error) {
    next(error);
  }
};

const toggleStationStatus = async (req, res, next) => {
  try {
    const station = await Station.findById(req.params.stationId);

    if (!station) {
      return res.status(404).json({ success: false, message: 'Station not found' });
    }

    if (station.ownerofStation.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to modify this station',
      });
    }

    station.isOpen = !station.isOpen;
    await station.save();

    
    const io = req.app.get('io');
    if (io) {
      io.emit('station:statusChanged', {
        stationId: station._id,
        isOpen: station.isOpen,
        name: station.name,
      });
    }

    res.json({
      success: true,
      message: `Station is now ${station.isOpen ? 'OPEN' : 'CLOSED'}`,
      data: { isOpen: station.isOpen },
    });
  } catch (error) {
    next(error);
  }
};

const addReview = async (req, res, next) => {
  try {
    const { comment, rating } = req.body;
    const station = await Station.findById(req.params.stationId);

    if (!station) {
      return res.status(404).json({ success: false, message: 'Station not found' });
    }

    
    const existingReview = station.reviews.find(
      (r) => r.userId === req.user.id
    );

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this station',
      });
    }

    station.reviews.push({
      userId: req.user.id,
      comment,
      rating,
    });

    await station.save();

    res.status(201).json({
      success: true,
      message: 'Review added successfully',
      data: station.reviews[station.reviews.length - 1],
    });
  } catch (error) {
    next(error);
  }
};

const getMyStations = async (req, res, next) => {
  try {
    const stations = await Station.find({ ownerofStation: req.user.id });
    res.json({
      success: true,
      count: stations.length,
      data: stations,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  addStation,
  getNearbyStations,
  getStationById,
  updateStation,
  toggleStationStatus,
  addReview,
  getMyStations,
};