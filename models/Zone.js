const mongoose = require('mongoose');

const VertexSchema = new mongoose.Schema({
    x: {
        type: Number,
        required: true,
    },
    y: {
        type: Number,
        required: true,
    }
}, { _id: false });

const ZoneSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    zone_name: {
        type: String,
        required: true,
    },
    vertices: {
        type: [VertexSchema],
        required: true,
        validate: {
            validator: function(v) {
                return v.length >= 3;
            },
            message: 'Zone must have at least 3 vertices'
        }
    }
}, {
    timestamps: true,
});

module.exports = mongoose.model('Zone', ZoneSchema);
