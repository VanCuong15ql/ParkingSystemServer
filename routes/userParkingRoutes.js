const express = require('express');
const router = express.Router();
const UserParking = require('../models/UserParking');
// get data from database
router.get('/', async (req, res) => {
    try {
        console.log('Request get user parking:', req.query);
        const { userId } = req.query;
        const query = userId ? { userId } : {};
        const userParkings = await UserParking.find(query).populate('userId', 'name email');
        res.json(userParkings);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});
// add user parking
router.post('/', async (req, res) => {
    try {
        console.log('Request body:', req.body);
        const { userId, uid, name, gender, numberphone, email, address } = req.body;
        const newUserParking = new UserParking({
            userId,
            uid,
            name,
            gender,
            numberphone,
            email,
            address,
        });
        await newUserParking.save();
        
        res.status(201).json(newUserParking);
    } catch (err) {
        if(err.code === 11000) {
            return res.status(400).json({ message: 'User parking with this UID or email already exists' });
        }else{
            res.status(500).json({ message: err.message });
        }
    }
}
);
// edit user parking
router.put('/:id', async (req, res) => {
    try {
        console.log('Request edit infor user parking')
        console.log('Request params:', req.params);
        console.log('Request body:', req.body);
        const updatedUserParking = await UserParking.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );
        if (!updatedUserParking) {
            return res.status(404).json({ message: 'User parking not found' });
        }
        res.json(updatedUserParking);
    } catch (err) {
        if(err.code === 11000) {
            return res.status(400).json({ message: 'User parking with this UID or email already exists' });
        }else{
            res.status(500).json({ message: err.message });
        }
    }
}
);
// delete user parking
router.delete('/:id', async (req, res) => {
    try {
        console.log('Request delete user parking')
        console.log('Request params:', req.params);
        const deletedUserParking = await UserParking.findByIdAndDelete(req.params.id);
        if (!deletedUserParking) {
            return res.status(404).json({ message: 'User parking not found' });
        }
        res.json({ message: 'User parking deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
}
);
module.exports = router;