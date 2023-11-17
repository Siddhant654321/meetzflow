const express = require('express');
const auth = require('../middleware/auth.js');
const Router = new express.Router();
const scheduleModel = require('../Models/scheduleModel.js')
const saveNotifications = require('../saveNotifications');
const accountModel = require('../Models/accountModel.js');
const meetingModel = require('../Models/meetingModel.js')


Router.get('/schedule/endpoint/allSchedulers', auth, async (req, res) => {
    try {
        const schedulers = await scheduleModel.find({userId: req.userId})
        if(!schedulers.length){
            return res.status(200).send({noScheduler: 'You do not have any Scheduler yet'})
        }
        res.status(200).send({schedulers})
    } catch (error) {
        res.status(500).send({error: 'Server Error'})
    }
})

Router.get('/schedule/endpoint/:name', async (req, res) => {
    try{
        const scheduler = await scheduleModel.findOne({schedulerName: req.params.name})
        if(!scheduler){
            return res.status(404).send({noScheduler: 'Scheduler with this name is not found'})
        }
        const account = await accountModel.findById(scheduler.userId)
        if(!account){
            return res.status(404).send({noScheduler: 'Scheduler with this name is not found'})
        }
        const meetings = await meetingModel.find({email: account.email})
        if(meetings.length === 0){
            return res.status(200).send({...scheduler, email: account.email, bookedTime: []})
        }
        const bookedTime = meetings.map((meeting) => meeting.time)
        res.status(200).send({...scheduler, email: account.email, bookedTime})
    } catch(error){
        res.status(500).send({error: 'Server Error'})
    }
})

Router.post('/schedule/endpoint/new', auth, async (req, res) => {
    try{
        if(req.body.schedulerName.includes(" ")){
            return res.status(400).send({spaceDetected: 'Scheduler Name cannot contain spaces'})
        }
        const scheduler = await scheduleModel.findOne({schedulerName: req.body.schedulerName})
        if(scheduler){
            return res.status(400).send({alreadyExists: 'Scheduler with this name already exists'})
        }
        if(req.body.daysArray.length === 0){
            return res.status(400).send({emptyDaysArray: 'You must provide at least one day in daysArray'})
        }
        await scheduleModel({...req.body, schedulerName: req.body.schedulerName.toLowerCase(), userId: req.userId}).save();
        return res.status(201).send('Scheduler Created Successfully!')
    } catch(error){
        res.status(500).send({error: 'Server Error'})
    }
})

Router.patch('/schedule/endpoint/:name', auth, async (req, res) => {
    try{
        if(req.body.schedulerName.includes(" ")){
            return res.status(400).send({spaceDetected: 'Scheduler Name cannot contain spaces'})
        }
        if(req.body.hasOwnProperty('schedulerName')){
            const isAlready = await scheduleModel.findOne({schedulerName: req.body.schedulerName});
            if(isAlready){
                return res.status(400).send({alreadyExists: 'Scheduler with this name already exists'})
            }
        }
        const scheduler = await scheduleModel.findOne({userId: req.userId, schedulerName: req.params.name});
        if(!scheduler){
            return res.status(404).send({noScheduler: 'Scheduler with this name is not found'})
        }
        const updates = Object.keys(req.body);
        const allowedUpdates = ['schedulerName','meetingTitle', 'meetingDescription', 'daysInAdvance', 'daysArray'];
        const isValidOperation = updates.every((update) =>
          allowedUpdates.includes(update)
        );
        if (!isValidOperation) {
          return res.status(400).send({ error: 'Invalid updates!' });
        }
        updates.forEach((update) => (scheduler[update] = req.body[update]));
        await scheduler.save();
        await saveNotifications(`You have updated your scheduler ${scheduler.schedulerName}`, 'scheduler', req.userId);
    } catch(error){
        res.status(500).send({error: 'Server Error'})
    }
})

Router.delete('/schedule/endpoint/:name', auth, async (req, res) => {
    try{
        const scheduler = await scheduleModel.findOneAndDelete({userId: req.userId, schedulerName: req.params.name});
        if(!scheduler){
            return res.status(404).send({noScheduler: 'Scheduler with this name is not found'})
        }
        res.status(200).send(`Scheduler ${req.params.name} is deleted successfully`)
    } catch (error){
        return res.status(500).send({error: 'Server Error'})
    }
})

module.exports = Router;