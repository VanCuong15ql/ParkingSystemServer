const express =  require('express');
const mongoose = require('mongoose');
const mqtt = require('mqtt');
const cors = require('cors')
const userRoutes = require('./routes/userRoutes');
const parkingSpaceRoutes = require('./routes/parkingSpaceRoutes');
const userParkingRoutes = require('./routes/userParkingRoutes');
const accessManageRoutes = require('./routes/accessManageRoutes');
const zoneRoutes = require('./routes/zoneRoutes');
const nodeRoutes = require('./routes/nodeRoutes');
const edgeRoutes = require('./routes/edgeRoutes');
const gateProcessingRoutes = require('./routes/gateProcessingRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const { getIntersectionSlotCounts } = require('./utils/pathfindingService');
const { initializeSocket, emitParkingSpacesUpdate } = require('./socket/socket');
const app = express();
require('dotenv').config();
const port = process.env.PORT || 5000;
const mongoURI = process.env.MONGO_URI 
app.use(cors())
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
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
const mqttClient = mqtt.connect('mqtt://broker.emqx.io')
app.set('mqttClient', mqttClient);
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
            
            // Check current state in database
            const currentParkingSpace = await ParkingSpace.findById(id);
            if (!currentParkingSpace) {
                console.log('Parking space not found:', id);
                return;
            }
            
            // Only update and recalculate if state actually changed
            if (currentParkingSpace.state !== state) {
                const updatedParkingSpace = await ParkingSpace.findByIdAndUpdate(
                    id,
                    { state },
                    { new: true }
                );
                console.log('Updated parking space:', updatedParkingSpace);

                // Emit parking spaces update via socket
                try {
                    const allParkingSpaces = await ParkingSpace.find({ userId: currentParkingSpace.userId });
                    emitParkingSpacesUpdate(currentParkingSpace.userId, allParkingSpaces);
                } catch (error) {
                    console.error('Error emitting parking spaces update:', error);
                }

                // Recalculate intersection slots when state changes
                await getIntersectionSlotCounts(currentParkingSpace.userId, null, mqttClient);
            } else {
                console.log('State unchanged, skipping update');
            }
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
app.use('/zones', zoneRoutes);
app.use('/nodes', nodeRoutes);
app.use('/edges', edgeRoutes);
app.use('/gate-processing', gateProcessingRoutes);
app.use('/notifications', notificationRoutes);
app.get('/', (req, res) => {
    res.send('server is running');
});
const server = app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

// Initialize Socket.io
initializeSocket(server);

