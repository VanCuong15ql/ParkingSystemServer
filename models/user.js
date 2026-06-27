const mongoose = require('mongoose');
const UserSchema = new mongoose.Schema({
    email:{
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    password: {
        type: String,
        required: true,
    },
    map: {
        type: String,
        default: null,
    },
    focusedEntranceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Node',
        default: null,
    },
}, {
    timestamps: true,
});

module.exports = mongoose.model('User', UserSchema);