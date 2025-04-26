const mongoose = require('mongoose');
const UserParkingSchema = new mongoose.Schema({
    uid:{
        type: String,
        required: true,
        unique: true,
    },
    name:{
        type:String,
        required:true,
    },
    gender:{
        type:String,
        enum:['Male','Female','Other'],
        required:true,
    },
    numberphone:{
        type:String,
        required:true,
    },
    email:{
        type:String,
        required:true,
        unique:true,
    },
    address:{
        type:String,
    },
    userId:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
},
{
    timestamps:true,
});
module.exports = mongoose.model('UserParking', UserParkingSchema);