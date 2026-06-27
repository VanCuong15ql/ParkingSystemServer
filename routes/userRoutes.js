const express = require('express');
const router = express.Router();
const User = require('../models/user');
const bcrypt = require('bcrypt');
// register a new user
router.post('/register', async (req,res)=>{
    try{
        console.log("payload",req.body);
        const { email, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ email, password: hashedPassword });
        await newUser.save();
        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error registering user', error });
        console.error('Error registering user:', error);
    }
});
// login

router.post('/login', async (req, res) => {
    try {
        console.log("request login: ",req.body);
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        res.status(200).json({ message: 'Login successful', userId: user._id });
        //respone for client userid
        console.log("user id",user._id);
        
    } catch (error) {
        res.status(500).json({ message: 'Error logging in', error });
        console.error('Error logging in:', error);
    }
});

// Get user by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findById(id).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching user', error });
        console.error('Error fetching user:', error);
    }
});

// Update user map
router.put('/:id/map', async (req, res) => {
    try {
        const { id } = req.params;
        const { map } = req.body;

        if (!map) {
            return res.status(400).json({ message: 'Map image (base64) is required' });
        }

        const updatedUser = await User.findByIdAndUpdate(
            id,
            { map },
            { new: true }
        ).select('-password');

        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).json({ message: 'Map updated successfully', user: updatedUser });
    } catch (error) {
        res.status(500).json({ message: 'Error updating map', error });
        console.error('Error updating map:', error);
    }
});

// Set focused entrance for pathfinding
router.put('/:id/focused-entrance', async (req, res) => {
    try {
        const { id } = req.params;
        const { entranceNodeId } = req.body;

        const updatedUser = await User.findByIdAndUpdate(
            id,
            { focusedEntranceId: entranceNodeId || null },
            { new: true }
        ).select('-password');

        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).json({
            message: 'Focused entrance updated',
            focusedEntranceId: updatedUser.focusedEntranceId,
        });
    } catch (error) {
        res.status(500).json({ message: 'Error updating focused entrance', error });
        console.error('Error updating focused entrance:', error);
    }
});

// Get focused entrance
router.get('/:id/focused-entrance', async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('focusedEntranceId');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.status(200).json({ focusedEntranceId: user.focusedEntranceId });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching focused entrance', error });
        console.error('Error fetching focused entrance:', error);
    }
});

// Get user map
router.get('/:id/map', async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findById(id).select('map');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).json({ map: user.map });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching map', error });
        console.error('Error fetching map:', error);
    }
});

module.exports = router;