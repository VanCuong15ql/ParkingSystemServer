const express = require('express');
const router = express.Router();
const Zone = require('../models/Zone');
const ParkingSpace = require('../models/parkingSpace');
const { isPointInPolygon } = require('../utils/zoneUtils');
const { setParkingSlotOnZone } = require('../utils/setParkingSlotOnZone');

// Create a new zone
router.post('/', async (req, res) => {
    try {
        console.log('Create zone request:', req.body);
        const { userId, zone_name, vertices } = req.body;

        if (!userId || !zone_name || !vertices || vertices.length < 3) {
            return res.status(400).json({ message: 'Invalid zone data. Zone must have at least 3 vertices.' });
        }

        const newZone = new Zone({ userId, zone_name, vertices });
        await newZone.save();
        const slotResult = await setParkingSlotOnZone(newZone._id);
        res.status(201).json({ ...newZone.toObject(), parkingSlots: slotResult });
    } catch (error) {
        res.status(500).json({ message: 'Error creating zone', error });
        console.error('Error creating zone:', error);
    }
});

// Get all zones for a user
router.get('/', async (req, res) => {
    try {
        const { userId } = req.query;
        if (!userId) {
            return res.status(400).json({ message: 'userId is required' });
        }

        const zones = await Zone.find({ userId });
        res.status(200).json(zones);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching zones', error });
        console.error('Error fetching zones:', error);
    }
});

// Get parking slots in a zone
router.get('/:id/parking-slots', async (req, res) => {
    try {
        const zone = await Zone.findById(req.params.id);
        if (!zone) {
            return res.status(404).json({ message: 'Zone not found' });
        }

        const result = await setParkingSlotOnZone(zone._id);
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching zone parking slots', error });
        console.error('Error fetching zone parking slots:', error);
    }
});

// Get zone by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const zone = await Zone.findById(id);

        if (!zone) {
            return res.status(404).json({ message: 'Zone not found' });
        }

        res.status(200).json(zone);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching zone', error });
        console.error('Error fetching zone:', error);
    }
});

// Update a zone
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { zone_name, vertices } = req.body;

        if (vertices && vertices.length < 3) {
            return res.status(400).json({ message: 'Zone must have at least 3 vertices.' });
        }

        const updatedZone = await Zone.findByIdAndUpdate(
            id,
            { zone_name, vertices },
            { new: true, runValidators: true }
        );

        if (!updatedZone) {
            return res.status(404).json({ message: 'Zone not found' });
        }

        const slotResult = await setParkingSlotOnZone(updatedZone._id);
        res.status(200).json({ ...updatedZone.toObject(), parkingSlots: slotResult });
    } catch (error) {
        res.status(500).json({ message: 'Error updating zone', error });
        console.error('Error updating zone:', error);
    }
});

// Delete a zone
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Remove zone_id reference from all parking spaces in this zone
        await ParkingSpace.updateMany(
            { zone_id: id },
            { $set: { zone_id: null } }
        );

        const deletedZone = await Zone.findByIdAndDelete(id);

        if (!deletedZone) {
            return res.status(404).json({ message: 'Zone not found' });
        }

        res.status(200).json({ message: 'Zone deleted successfully', zone: deletedZone });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting zone', error });
        console.error('Error deleting zone:', error);
    }
});

// Check which zone a parking space belongs to and update it
router.post('/check-zone/:parkingSpaceId', async (req, res) => {
    try {
        const { parkingSpaceId } = req.params;
        const { locationx, locationy } = req.body;

        if (locationx === undefined || locationy === undefined) {
            return res.status(400).json({ message: 'locationx and locationy are required' });
        }

        const parkingSpace = await ParkingSpace.findById(parkingSpaceId);
        if (!parkingSpace) {
            return res.status(404).json({ message: 'Parking space not found' });
        }

        const zones = await Zone.find({ userId: parkingSpace.userId });
        const point = { x: locationx, y: locationy };

        let foundZone = null;
        for (const zone of zones) {
            if (isPointInPolygon(point, zone.vertices)) {
                foundZone = zone;
                break;
            }
        }

        if (foundZone) {
            parkingSpace.zone_id = foundZone._id;
        } else {
            parkingSpace.zone_id = null;
        }

        await parkingSpace.save();
        res.status(200).json({
            message: foundZone ? `Parking space assigned to zone: ${foundZone.zone_name}` : 'No zone found for this parking space',
            parkingSpace,
            zoneId: foundZone ? foundZone._id : null,
            zoneName: foundZone ? foundZone.zone_name : null
        });
    } catch (error) {
        res.status(500).json({ message: 'Error checking zone', error });
        console.error('Error checking zone:', error);
    }
});

// Batch check zones for multiple parking spaces
router.post('/batch-check', async (req, res) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({ message: 'userId is required' });
        }

        const parkingSpaces = await ParkingSpace.find({ userId });
        const zones = await Zone.find({ userId });

        const results = [];

        for (const parkingSpace of parkingSpaces) {
            const point = { x: parkingSpace.locationx, y: parkingSpace.locationy };
            let foundZone = null;

            for (const zone of zones) {
                if (isPointInPolygon(point, zone.vertices)) {
                    foundZone = zone;
                    break;
                }
            }

            parkingSpace.zone_id = foundZone ? foundZone._id : null;
            await parkingSpace.save();

            results.push({
                parkingSpaceId: parkingSpace._id,
                parkingSpaceName: parkingSpace.name,
                zoneId: foundZone ? foundZone._id : null,
                zoneName: foundZone ? foundZone.zone_name : null
            });
        }

        res.status(200).json({
            message: 'Batch zone check completed',
            results
        });
    } catch (error) {
        res.status(500).json({ message: 'Error batch checking zones', error });
        console.error('Error batch checking zones:', error);
    }
});

module.exports = router;
