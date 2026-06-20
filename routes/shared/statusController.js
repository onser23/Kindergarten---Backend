const mongoose = require('mongoose');
const statusConfig = require('../../config/statusConfig');

const makeStatusHandler = (entityKey) => async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Yanlış ID formatı' });
    }
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ success: false, message: 'isActive boolean olmalıdır' });
    }

    const config = statusConfig[entityKey];
    if (!config) {
      return res.status(500).json({ success: false, message: 'Naməlum entity' });
    }

    const { Model, usageCheck, blockedMessage, entityName } = config;

    const entity = await Model.findById(id);
    if (!entity) {
      return res.status(404).json({ success: false, message: `${entityName} tapılmadı` });
    }

    if (isActive === false && entity.isActive === true) {
      const { count, locations } = await usageCheck(id);
      if (count > 0) {
        return res.status(400).json({
          success: false,
          message: blockedMessage(locations),
          usageCount: count,
          usageLocations: locations,
        });
      }
    }

    entity.isActive = isActive;
    await entity.save();

    res.json({
      success: true,
      message: isActive ? `${entityName} aktivləşdirildi` : `${entityName} passivləşdirildi`,
      data: entity,
    });
  } catch (error) {
    console.error(`Status toggle error (${entityKey}):`, error);
    res.status(500).json({ success: false, message: 'Status dəyişdirilə bilmədi' });
  }
};

module.exports = { makeStatusHandler };