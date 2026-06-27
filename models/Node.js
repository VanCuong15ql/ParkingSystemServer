const mongoose = require('mongoose');

const NodeSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    name: {
        type: String,
    },
    type: {
        type: String,
        enum: ['entrance', 'intersection', 'zone_link', 'connector'],
    },
    x: {
        type: Number,
        required: true,
    },
    y: {
        type: Number,
        required: true,
    },
    zoneId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Zone',
        default: null,
    },
}, {
    timestamps: true,
});

module.exports = mongoose.model('Node', NodeSchema);
