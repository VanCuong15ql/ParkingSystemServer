const express =  require('express');
const mongoose = require('mongoose');
const mqtt = require('mqtt');
const cors = require('cors')
const userRoutes = require('./routes/userRoutes');
const parkingSpaceRoutes = require('./routes/parkingSpaceRoutes');
const userParkingRoutes = require('./routes/userParkingRoutes');
const accessManageRoutes = require('./routes/accessManageRoutes');
const app = express();
require('dotenv').config();
const port = process.env.PORT || 5000;
const mongoURI = process.env.MONGO_URI 
app.use(cors())
app.use(express.json());
const ParkingSpace = require('./models/parkingSpace');
const UserParking = require('./models/UserParking');
const AccessManage = require('./models/AccessManage');


mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
    })
    .then(() => {
        console.log('MongoDB connected');
    })
    .catch((error) => {
        console.error('MongoDB connection error:', error);
    });
// MQTT connection
const mqttClient = mqtt.connect('http:localhost:1883')
mqttClient.on('connect', () => {
    console.log('Connected to MQTT broker');
    mqttClient.subscribe('parking/state', (err) => {
        if (err) {
            console.error('Error subscribing to topic:', err);
        } else {
            console.log('Subscribed to topic: parking/state');
        }
    });
    mqttClient.subscribe('parking/gate_for_entering', (err) => {
        if (err) {
            console.error('Error subscribing to topic:', err);
        } else {
            console.log('Subscribed to topic: parking/gate_for_entering');
        }
    });
    mqttClient.subscribe('parking/gate_for_exiting', (err) => {
        if (err) {
            console.error('Error subscribing to topic:', err);
        } else {
            console.log('Subscribed to topic: parking/gate_for_exiting');
        }
    });
    
});

mqttClient.on('message',async (topic, message) => {
    if (topic === 'parking/state') {
        try{
            const data = JSON.parse(message.toString());
            console.log('Received message:', data);
            // Handle the received message here
            // For example, update the parking space state in the database
            const { id, state } = data;
            const updatedParkingSpace = await ParkingSpace.findByIdAndUpdate(
                id,
                { state },
                { new: true }
            );
            console.log('Updated parking space:', updatedParkingSpace);
        } catch (error) {
            console.error('Error updating parking space:', error);
        }
    }else if(topic === 'parking/gate_for_entering'){
        try{
            const data = JSON.parse(message.toString());
            console.log('Received message:', data);
            // Handle the received message here
            // For example, update the parking space state in the database
            const { uid, userId } = data;
            const user = await UserParking.findOne({ uid , userId });
            if (!user) {
                console.log('Entered User not found');
                return;
            }else{
                console.log('Entered User for entering found:', user);

                // check if access management record already exists
                const existingAccessManage = await AccessManage.findOne({
                    uid: user.uid,
                    userId: user.userId,
                    timeExited: null,
                });
                if (existingAccessManage) {
                    console.log('userParking already entered');
                    return;
                }
                // send topic to MQTT broker to open servor
                mqttClient.publish('parking/response_gate_for_entering', JSON.stringify({"message": "open"}));
                // Creat the access management record
                const accessManage = new AccessManage({
                    uid: user.uid,
                    userId: user.userId,
                    userParkingId: user._id,
                    timeEntered: new Date(),
                });
                await accessManage.save();
                console.log('Time entered:', accessManage.timeEntered);
            }
        } catch (error) {
            console.error('Error Entered AccessManage record:', error);
        }
    }else if(topic === 'parking/gate_for_exiting'){
        try{
            const data = JSON.parse(message.toString());
            console.log('Received message:', data);
            // Handle the received message here
            // update the parking space state in the database
            const { uid, userId } = data;
            // check do AccessManage enter ?
            const accessManageRecord = await AccessManage.findOne({
                uid,
                userId,
                timeExited: null,
            });
            if (!accessManageRecord) {
                console.log('Exited User not found or User already entered');
                return;
            }else{
                mqttClient.publish('parking/response_gate_for_exiting', JSON.stringify({"message": "open"}));
                console.log('Exited User found:', accessManageRecord);
                // Update the access management record
                accessManageRecord.timeExited = new Date();
                await accessManageRecord.save();
                console.log('Time exited:', accessManageRecord.timeExited);
            }
        } catch (error) {
            console.error('Error Exited AccessManage Record', error);
        }
    }
});
app.use('/users', userRoutes);
app.use('/parking-spaces', parkingSpaceRoutes);
app.use('/user-parking', userParkingRoutes);
app.use('/access-manage', accessManageRoutes);
app.get('/', (req, res) => {
    res.send('server is running');
});
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

