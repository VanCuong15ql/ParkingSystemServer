const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
    accessManageId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AccessManage',
        required: true,
    },
    errorMessage: {
        type: String,
        required: true,
    },
    errorType: {
        type: String,
        enum: ['ErrorEnter', 'ErrorExit', 'ErrorExitPass'],
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

const Notification = mongoose.model('Notification', NotificationSchema);

module.exports = Notification;
