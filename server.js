const express =  require('express');
const mongoose = require('mongoose');
const mqtt = require('mqtt');
const cors = require('cors')
const userRoutes = require('./routes/userRoutes');
const parkingSpaceRoutes = require('./routes/parkingSpaceRoutes');
const userParkingRoutes = require('./routes/userParkingRoutes');
const app = express();
const port = process.env.PORT || 5000;
app.use(cors())
app.use(express.json());
const ParkingSpace = require('./models/parkingSpace');
const mongoURI = "mongodb+srv://vancuongbui15ql:MAihw0QB6kdc1LLd@cluster0.4gqks.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

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
});

mqttClient.on('message',async (topic, message) => {
    if (topic === 'parking/state') {
        const data = JSON.parse(message.toString());
        console.log('Received message:', data);
        // Handle the received message here
        // For example, update the parking space state in the database
        const { id, state } = data;
        try{
            const updatedParkingSpace = await ParkingSpace.findByIdAndUpdate(
                id,
                { state },
                { new: true }
            );
            console.log('Updated parking space:', updatedParkingSpace);
        } catch (error) {
            console.error('Error updating parking space:', error);
        }
    }
});
app.use('/users', userRoutes);
app.use('/parking-spaces', parkingSpaceRoutes);
app.use('/user-parking', userParkingRoutes);
app.get('/', (req, res) => {
    res.send('server is running');
});
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

