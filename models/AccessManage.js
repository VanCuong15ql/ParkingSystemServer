const mongoose = require('mongoose');
const AccessManageSchema = new mongoose.Schema({
    uid: {
        type: String,
        required: true,
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    userParkingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'UserParking',
        required: true,
    },
    timeEntered: {
        type: Date,
        default: Date.now,
    },
    timeExited: {
        type: Date,
        default: null,
    },
});
const AccessManage = mongoose.model('AccessManage', AccessManageSchema);
module.exports = AccessManage;