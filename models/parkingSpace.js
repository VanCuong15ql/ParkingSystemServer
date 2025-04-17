const express = require('express');
const mongoose = require('mongoose');
const ParkingSpaceSchema = new mongoose.Schema({
    name:{
        type: String,
        required: true,
        
    },
    typeParking:{
        type:String,
        enum:['car','bike','motor'],
    },
    state:{
        type: String,
        enum: ['available', 'occupied'],
        default: 'available',
    },
    healt:{
        type: String,
        enum: ['live', 'die'],
        default: 'live',
    },
    locationx:{
        type: Number,
        default: 0,
    },
    locationy:{
        type: Number,
        default: 0,
    },
    userId:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    }},{timestamps: true});

module.exports = mongoose.model('ParkingSpace', ParkingSpaceSchema);