
const isStationOwner = (req, res, next) => {
    if (req.user.role !== 'StationOwner') {
      return res.status(403).json({ error: 'Access denied. Only StationOwners can perform this action.' });
    }
    next();
  };
  
  module.exports = {
    isStationOwner,
  };