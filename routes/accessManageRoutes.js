const express = require('express');
const router = express.Router();
const AccessManage = require('../models/AccessManage');


router.get('/', async (req, res) => {
    try {
        
        console.log('Request get access manage:', req.query);
        
        const { userId } = req.query;
        if (!userId) {
            return res.status(400).json({ message: 'User ID is required' });
        }

        const query = userId ? { userId } : {};
        
        const accessManages = await AccessManage.find(query)
            .populate({
                path: 'userParkingId',
                select: 'name',
            });
        console.log('Access manages:', accessManages);
        res.status(200).json(accessManages);
    } catch (error) {
        console.error('Error fetching access manages:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
module.exports = router;