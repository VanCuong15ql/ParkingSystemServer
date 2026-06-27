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
    plate_text_enter: {
        type: String,
        default: null,
    },
    plate_image_enter: {
        type: String,
        default: null,
    },
    plate_text_exit: {
        type: String,
        default: null,
    },
    plate_image_exit: {
        type: String,
        default: null,
    },
});
const AccessManage = mongoose.model('AccessManage', AccessManageSchema);
module.exports = AccessManage;