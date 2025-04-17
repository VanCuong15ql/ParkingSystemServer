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
module.exports = router;