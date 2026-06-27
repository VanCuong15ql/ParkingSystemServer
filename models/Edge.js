const mongoose = require('mongoose');

const EdgeSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    fromNode: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Node',
        required: true,
    },
    toNode: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Node',
        required: true,
    },
}, {
    timestamps: true,
});

module.exports = mongoose.model('Edge', EdgeSchema);
