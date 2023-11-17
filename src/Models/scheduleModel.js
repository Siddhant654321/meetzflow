const mongoose = require('../../mongoose');

const scheduleSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true
    },
    schedulerName: {
        type: String,
        required: true,
        minLength: 2,
        unique: true
    },
    meetingTitle: {
        type: String,
        required: true
    },
    meetingDescription: {
        type: String,
        required: true
    },
    daysInAdvance: {
        type: Number,
        default: 365
    },
    daysArray:{
        type: Array,
        default: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
    },
    timeAllowed: {
        type: Array,
        default: ['0:00-23:30']
    }
})

const scheduleModel = mongoose.model('Schedule', scheduleSchema);

module.exports = scheduleModel;