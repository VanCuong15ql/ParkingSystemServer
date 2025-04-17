const express =  require('express');
const mongoose = require('mongoose');
const cors = require('cors')
const userRoutes = require('./routes/userRoutes');
const parkingSpaceRoutes = require('./routes/parkingSpaceRoutes');
const app = express();
const port = process.env.PORT || 5000;
app.use(cors())
app.use(express.json());

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
app.use('/users', userRoutes);
app.use('/parking-spaces', parkingSpaceRoutes);
app.get('/', (req, res) => {
    res.send('server is running');
});
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

