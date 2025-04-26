const express = require('express');
const router = express.Router();
const ParkingSpace = require('../models/parkingSpace');
// add parking space
router.post('/', async (req, res) => {
    try {
        console.log('Request body:', req.body);
        const { name, type,userId } = req.body;
        const newParkingSpace = new ParkingSpace({ name, typeParking: type,userId });
        await newParkingSpace.save();
        res.status(201).json(newParkingSpace);
    } catch (error) {
        res.status(500).json({ message: 'Error adding parking space', error });
        console.error('Error adding parking space:', error);
    }
});
// get all parking spaces
router.get('/', async (req, res) => {
    try {
        console.log('Request get parking spaces:', req.query);
        const { userId } = req.query;
        const query = userId ? { userId } : {};
        const parkingSpaces = await ParkingSpace.find(query);
        res.status(200).json(parkingSpaces);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching parking spaces', error });
        console.error('Error fetching parking spaces:', error);
    }
});
// edit parking space
router.put('/:id', async (req, res) => {
    try {
        console.log('Request edit infor parking space')
        console.log('Request params:', req.params);
        console.log('Request body:', req.body);
        const { id } = req.params;
        const { name, type } = req.body;
        const updatedParkingSpace = await ParkingSpace.findByIdAndUpdate(
            id,
            { name, typeParking: type},
            { new: true }
        );
        res.status(200).json(updatedParkingSpace);
    } catch (error) {
        res.status(500).json({ message: 'Error updating parking space', error });
        console.error('Error updating parking space:', error);
    }
    });
// delete parking space
router.delete('/:id', async (req, res) => {
    try {
        console.log('Request delete parking space')
        console.log('Request params:', req.params);
        const { id } = req.params;
        await ParkingSpace.findByIdAndDelete(id);
        res.status(200).json({ message: 'Parking space deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting parking space', error });
        console.error('Error deleting parking space:', error);
    }
});
// set location
router.post('/location/:id', async (req, res) => {
    try {
        console.log('Request set location parking space')
        console.log('Request params:', req.params);
        console.log('Request body:', req.body);
        const { id } = req.params;
        const { locationx,locationy } = req.body;
        const updatedParkingSpace = await ParkingSpace.findByIdAndUpdate(
            id,
            { locationx, locationy },
            { new: true }
        );
        res.status(200).json(updatedParkingSpace);
    } catch (error) {
        res.status(500).json({ message: 'Error updating parking space', error });
        console.error('Error updating parking space:', error);
    }
});
// set state
router.post('/state/', async (req, res) => {
    try {
        console.log('Request set state parking space')
        console.log('Request body:', req.body);
        const {id, state } = req.body;
        const updatedParkingSpace = await ParkingSpace.findByIdAndUpdate(
            id,
            { state },
            { new: true }
        );
        res.status(200).json(updatedParkingSpace);
    } catch (error) {
        res.status(500).json({ message: 'Error updating parking space', error });
        console.error('Error updating parking space:', error);
    }
});
module.exports = router;