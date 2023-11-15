const mongoose = require('../../mongoose');

const chatSchema = {
    teamId: {
        type: String,
        required: true
    },
    teamName: {
        type: String,
        required: true
    },
    chat: [{
        time: {
            type: Date,
            required: true
        },
        sentByName: {
            type: String,
            required: true
        },
        sentByEmail: {
            type: String,
            required: true
        },
        chatMessage: {
            type: String
        },
        imageMessage: {
            type: String
        },
        meetingMessage: {
            type: String
        },
        meetingLink:{
            type: String
        }
    }]
}

const chatModel = mongoose.model('Chat Messages', chatSchema);

module.exports = chatModel