const Zone = require('../models/Zone');
const ParkingSpace = require('../models/parkingSpace');
const { isPointInPolygon } = require('./zoneUtils');

async function setParkingSlotOnZone(zoneId) {
    const zone = await Zone.findById(zoneId);
    if (!zone) {
        throw new Error('Zone not found');
    }

    const parkingSpaces = await ParkingSpace.find({ userId: zone.userId });
    const assignedIds = [];

    for (const space of parkingSpaces) {
        if (space.locationx === 0 && space.locationy === 0) continue;

        const point = { x: space.locationx, y: space.locationy };
        const inside = isPointInPolygon(point, zone.vertices);

        if (inside) {
            space.zone_id = zone._id;
            await space.save();
            assignedIds.push(space._id);
        }
    }

    await ParkingSpace.updateMany(
        {
            zone_id: zoneId,
            _id: { $nin: assignedIds },
        },
        { $set: { zone_id: null } }
    );

    const slots = await ParkingSpace.find({ zone_id: zoneId });
    return {
        zoneId,
        zoneName: zone.zone_name,
        count: slots.length,
        slots,
    };
}

module.exports = { setParkingSlotOnZone };
