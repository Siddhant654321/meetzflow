const mongoose = require('../../mongoose');
const validator = require("email-validator");

const meetingSchema = new mongoose.Schema({
    _id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    email: {
        type: String,
        required: true,
        validate(value) {
            if(!validator.validate(value)){
                throw new Error('Invalid Email')
            }
        }
    },
    scheduler: {
        type: String,
        required: true
    },
    scheduledBy: {
        type: String,
        required: true,
        minlength: 2
    },
    schedulerEmail: {
        type: String,
        required: true,
        validate(value) {
            if(!validator.validate(value)){
                throw new Error('Invalid Email')
            }
        }
    },
    time: {
        type: Date,
        required: true
    },
    meetingTitle: {
        type: String,
        required: true
    },
    meetingDescription: {
        type: String,
        required: true
    },
    meetingLink: {
        type: String,
        required: true
    }
})

const meetingModel = mongoose.model('Meetings', meetingSchema);

module.exports = meetingModel;