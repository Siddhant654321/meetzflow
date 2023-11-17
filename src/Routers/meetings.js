const express = require('express');
const meetingModel = require('../Models/meetingModel');
const accountModel = require('../Models/accountModel')
const auth = require('../middleware/auth');
const saveNotifications = require('../saveNotifications');
const mongoose = require('mongoose');
const moment = require('moment-timezone');
const getChat = require('../middleware/getChat');
const saveMultipleNotifications = require('../saveMultipleNotifications.js')
const { google } = require('googleapis');
const getOAuthClient = require('../getOAuthClient');
const { v4: uuidv4 } = require('uuid');
const chatModel = require('../Models/chatModel');

const Router = new express.Router();

Router.post('/meetings/endpoint/new', async (req, res) => {
    try {
        const _id = new mongoose.Types.ObjectId();
        const account = await accountModel.findOne({email: req.body.email});
        if(!account){
            return res.status(404).send({error: 'Account with this email does not exist'})
        }
        const selectedDate = moment(req.body.selectedDate).format('YYYY-MM-DD');
        const userTimeZone = req.body.timeZone; 
        const startDateTime = moment.tz(`${selectedDate} ${req.body.time}`, 'YYYY-MM-DD HH:mm', userTimeZone);
        const endDateTime = startDateTime.clone().add(60, 'minutes');
        const formattedStartTime = startDateTime.clone().tz("America/Los_Angeles").toISOString();
        const formattedEndTime = endDateTime.clone().tz("America/Los_Angeles").toISOString();
        const pacificTime = startDateTime.clone().tz("America/Los_Angeles").format();
        const oauth2Client = getOAuthClient(account.googleAuthorizationCode)
        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
        
        const event = {
        summary: req.body.meetingTitle, // Title of the meeting
        description: req.body.meetingDescription, // Description of the meeting
        start: {
            dateTime: formattedStartTime, // Start time in ISO format
            timeZone: 'America/Los_Angeles', // Time zone of the start time
        },
        end: {
            dateTime: formattedEndTime, // End time in ISO format
            timeZone: 'America/Los_Angeles', // Time zone of the end time
        },
        attendees: [
            { email: req.body.schedulerEmail }
        ],
        conferenceData: {
                createRequest: {
                requestId: _id.toString(), // A unique identifier for the request
                conferenceSolutionKey: { type: 'hangoutsMeet' },
                },
            },
        };

        try {
            const googleData = await calendar.events.insert({
                calendarId: 'primary',
                resource: event,
                conferenceDataVersion: 1, // Indicates that conference data (Google Meet link) should be returned
            });
            await meetingModel({...req.body, time: pacificTime, _id, meetingLink: googleData.data.hangoutLink}).save();
            await saveNotifications(`${req.body.scheduledBy} has scheduled a new meeting with you`, 'meeting', account._id);
            res.status(201).send(`Meeting scheduled successfully. Join Link - ${googleData.data.hangoutLink}`);
        } catch (err) {
            throw new Error('Meeting cannot be scheduled due to unforeseen error');
        }

    } catch (error) {
        res.status(500).send({error: 'Server Error'})
    }
})

Router.post('/meetings/endpoint/team/new', auth, getChat, async (req, res) => {
    try {
        const selectedDate = moment(req.body.selectedDate).format('YYYY-MM-DD');
        const startDateTime = moment.tz(`${selectedDate} ${req.body.time}`, 'YYYY-MM-DD HH:mm', 'America/Los_Angeles');
        const endDateTime = startDateTime.clone().add(60, 'minutes');
        const formattedStartTime = startDateTime.clone().tz("America/Los_Angeles").toISOString();
        const formattedEndTime = endDateTime.clone().tz("America/Los_Angeles").toISOString();
        const pacificTime = moment(formattedStartTime).tz("America/Los_Angeles").format('DD MMM YYYY [at] h:mm a');
        const oauth2Client = getOAuthClient(req.account.googleAuthorizationCode)
        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
        const members = [...req.team.admin, ...req.team.members]
        const attendees = members.map(member => ({ email: member.email }));

        const event = {
        summary: req.body.meetingTitle, // Title of the meeting
        start: {
            dateTime: formattedStartTime, // Start time in ISO format
            timeZone: 'America/Los_Angeles', // Time zone of the start time
        },
        end: {
            dateTime: formattedEndTime, // End time in ISO format
            timeZone: 'America/Los_Angeles', // Time zone of the end time
        },
        attendees,
        conferenceData: {
                createRequest: {
                requestId: uuidv4(), // A unique identifier for the request
                conferenceSolutionKey: { type: 'hangoutsMeet' },
                },
            },
        };

        try {
            const googleData = await calendar.events.insert({
                calendarId: 'primary',
                resource: event,
                conferenceDataVersion: 1, // Indicates that conference data (Google Meet link) should be returned
            });
            req.chat.chat.push({time: req.body.currentTime, sentByName: req.account.name, sentByEmail: req.account.email, meetingMessage: `hosted a meeting for '${req.body.meetingTitle}' and it will commence on ${pacificTime}`, meetingLink: googleData.data.hangoutLink})
            const memberEmails = members.map(member => member.email)
            await chatModel.findByIdAndUpdate(req.chat._id, { chat: req.chat.chat })
            await saveMultipleNotifications(`${req.account.name} has scheduled a meeting in ${req.team.team}`, 'team', memberEmails)
            res.status(201).send({meetingTime: pacificTime, meetingLink: googleData.data.hangoutLink})
        } catch (err) {
            throw new Error('Meeting cannot be scheduled due to unforeseen error');
        }
    } catch (error) {
        res.status(500).send({error: 'Server Error'})
    }
})

Router.get('/meetings/endpoint/all', auth, async (req, res) => {
    try {
        const meetings = await meetingModel.find({email: req.user.email}).sort({time: 1})
        if(!meetings.length){
            return res.status(200).send({noMeeting: 'You do not have any meeting yet'})
        }
        res.status(200).send({meetings})
    } catch (error) {
        res.status(500).send({error})
    }
})

Router.get('/meetings/endpoint/:name', auth, async (req, res) => {
    try {
        const meetings = await meetingModel.find({email: req.user.email, scheduler: req.params.name}).sort({time: 1})
        if(!meetings.length){
            return res.status(404).send({noMeetingError: 'This scheduler does not have any meetings'})
        }
        return res.status(200).send(meetings)
    } catch (error) {
        return res.status(400).send({error})
    }
})


Router.get('/meetings/endpoint/id/:id', auth, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(404).send({error: 'Meeting not found!'});
        }
        const meeting = await meetingModel.findById(req.params.id);
        if(!meeting){
            return res.status(404).send({error: 'Meeting not found!'})
        }
        if(meeting.email !== req.user.email) {
            return res.status(401).send({error: 'You are not Authenticated to view the details of this meeting'})
        }
        return res.status(200).send(meeting);
    } catch(error) {
        return res.status(500).send({serverError: 'Server Error'})
    }
})

module.exports = Router;