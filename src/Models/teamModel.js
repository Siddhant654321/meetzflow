const mongoose = require('../../mongoose');

const teamSchema = new mongoose.Schema({
    team: {
        type: String,
        required: true
    },
    admin: [{
        name: {
            type: String,
            required: true
        },
        email: {
            type: String,
            required: true
        }
    }],
    members: [{
        name: {
            type: String,
            required: true
        },
        email: {
            type: String,
            required: true
        }
    }]
})

const teamModel = mongoose.model('Team', teamSchema)

module.exports = teamModel