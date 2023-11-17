const express = require('express');
const auth = require('../middleware/auth.js');
const teamModel = require('../Models/teamModel.js')
const Router = new express.Router();
const accountModel = require('../Models/accountModel.js')
const chatModel = require('../Models/chatModel.js')
const saveMultipleNotifications = require('../saveMultipleNotifications.js')
const saveNotifications = require('../saveNotifications.js')

Router.get('/team/endpoint/allTeams', auth, async (req, res) => {
    try {
        const teams = await teamModel.find({
            $or: [
                { "admin.email": req.user.email },
                { "members.email": req.user.email }
            ]
        })
        if(!teams.length){
            return res.status(200).send({noTeams: 'You do not have any team yet'})
        }

        const allTeams = teams.map(team => {
            const isAdmin = team.admin.some(admin => admin.email === req.user.email);
            return {...team._doc, isAdmin};
        });

        return res.status(200).send({teams: allTeams})
    } catch (error) {
        return res.status(500).send({error: 'Server Error'})
    }
})

Router.get('/team/endpoint/oneTeam/:teamName', auth, async (req, res) => {
    try {
        const teamName = decodeURIComponent(req.params.teamName)
        const team = await teamModel.findOne({
            team: teamName,
            $or: [
                { "admin.email": req.user.email },
                { "members.email": req.user.email }
            ]
        })
        if(!team){
            return res.status(404).send({noTeams: 'Team Not Found'})
        }

        return res.status(200).send(team)
    } catch (error) {
        return res.status(500).send({error: 'Server Error'})
    }
})

Router.post('/team/endpoint/new', auth, async (req, res) => {
    try {

        const teamData = {
        team: req.body.team,
        admin: [{
            name: req.user.name,
            email: req.user.email
        }],
        members: []
        };

        const newTeam = new teamModel(teamData);
        const team = await newTeam.save();
        await new chatModel({teamId: team._id, teamName: team.team}).save()
        return res.status(201).send({success: 'Team created successfully!'});
    } catch (error) {
        return res.status(500).send({error: 'Server Error'});
    }
});

Router.patch('/team/endpoint/newMember', auth, async (req, res) => {
    try {
        const {email, name} = req.user;
        const team = await teamModel.findOne({team: req.body.team, 'admin.email': email})
        if(team === null){
            return res.status(404).send({noTeam: 'No Such Team Exist'})
        }
        const member = await accountModel.findOne({email: req.body.memberEmail})
        if(member === null){
            return res.status(404).send({noAccount: 'Account with this email does not exist'})
        }
        if (team.admin.find(admin => admin.email === req.body.memberEmail) || 
            team.members.find(member => member.email === req.body.memberEmail)) {
            return res.status(400).send({memberExist: 'Member already exists'});
        }
        team.members.push({name: member.name, email: req.body.memberEmail})
        await team.save();
        await saveNotifications(`You have been added to Team ${req.body.team} by ${name}`, 'team', member._id);
        return res.status(200).send('Member Added Successfully')
    } catch (error) {
        return res.status(500).send({error: 'Server Error'})
    }
})

Router.patch('/team/endpoint/newAdmin', auth, async (req, res) => {
    try {
        const {email, name} = req.user
        const team = await teamModel.findOne({team: req.body.team, 'admin.email': email})
        if(team === null){
            return res.status(404).send({noTeam: 'No Such Team Exist'})
        }
        const member = await accountModel.findOne({email: req.body.memberEmail})
        if(member === null){
            return res.status(404).send({noAccount: 'Account with this email does not exist'})
        }
        team.admin.forEach(value => {
            if(value.email == req.body.memberEmail){
                return res.status(400).send({memberExist: 'Admin already exists'})
            }
        })
        let isAlreadyMember = false;
        team.members.forEach((value,index)=> {
            if(value.email == req.body.memberEmail){
                team.members.splice(index, 1)
                isAlreadyMember = true
            }
        })
        team.admin.push({name: member.name, email: req.body.memberEmail})
        await team.save();
        if(isAlreadyMember) {
            await saveNotifications(`You have been made the admin of Team ${req.body.team} by ${name}`, 'team', member._id);
        } else {
            await saveNotifications(`You have been added as an admin to Team ${req.body.team} by ${name}`, 'team', member._id);
        }
        return res.status(200).send('Admin Added Successfully')
    } catch (error) {
        return res.status(400).send({error})
    }
})

Router.get('/team/endpoint/getMembers/:team', auth, async (req, res) => {
    try {
        const {email} = req.user
        let team = await teamModel.findOne({team: req.params.team, $or: [
            { "admin.email": email },
            { "members.email": email }
        ]})
        if(team === null){
            return res.status(404).send('No Such Team Exist')
        }

        const emails = [...team.members, ...team.admin].map(person => person.email);

        const accounts = await accountModel.find({email: {$in: emails}});

        const accountsMap = new Map();
        for (let account of accounts) {
            accountsMap.set(account.email, account);
        }

        const mapPerson = (person) => {
            const account = accountsMap.get(person.email);
            return {
                name: person.name,
                email: person.email,
                avatar: account ? account.avatar : null
            };
        };

        const teamMembers = team.members.map(mapPerson);
        const teamAdmin = team.admin.map(mapPerson);

        const isAdmin = teamAdmin.some(admin => admin.email === email);

        return res.status(200).send({admin: teamAdmin, members: teamMembers, isAdmin})
    } catch (error) {
        return res.status(500).send({error: 'Server Error'})
    }
});

Router.delete('/team/endpoint/deleteTeam', auth, async (req, res) => {
    try {
        const {email, name} = req.user
        const team = await teamModel.findOneAndDelete({team: req.body.team, 'admin.email': email})
        if(team === null){
            return res.status(404).send('This Team does not exist')
        }
        await chatModel.findOneAndDelete({teamId: String(team._id)})
        const members = [...team.admin, ...team.members]
        const memberEmails = members.map(member => member.email)
        await saveMultipleNotifications(`Team ${req.body.team} has been deleted by ${name}`, 'team', memberEmails)
        return res.status(200).send('Team Deleted Successfully')
    } catch (error) {
        return res.status(500).send({error: 'Server Error'})
    }
})

Router.patch('/team/endpoint/removeMember', auth, async (req, res) => {
    try {
        const account = req.user
        const { team, memberEmail } = req.body; 
        if(!account){
            return res.status(404).send({message: "We couldn't find your account"})
        }
        let teamData = await teamModel.findOne({team});
        if (!teamData) {
            return res.status(404).json({ message: 'This Team does not exist' });
        }
        const adminIndex = teamData.admin.findIndex(admin => admin.email === account.email);
        if (adminIndex === -1) {
            return res.status(400).json({ message: 'Only Admin can remove a member of the team' });
        }
        const memberIndex = teamData.members.findIndex(member => member.email === memberEmail);
        if (memberIndex === -1) {
            return res.status(404).json({ message: 'Account with this email does not exist' });
        }
        teamData.members.splice(memberIndex, 1);
        await teamData.save();
        const {_id} = await accountModel.findOne({email: memberEmail})
        await saveNotifications(`You have been removed from Team ${req.body.team} by ${account.name}`, 'team', _id);
        return res.status(200).send('Member Removed Successfully')
    } catch (error) {
        return res.status(500).send({error: 'Server Error'});
    }
})

Router.patch('/team/endpoint/removeAdmin', auth, async (req, res) => {
    
    try {
        const account = req.user
        const { team, memberEmail } = req.body; 
        if(!account){
            return res.status(404).send({message: "We couldn't find your account"})
        }
        let teamData = await teamModel.findOne({team});
        if (!teamData) {
            return res.status(404).json({ message: 'This Team does not exist' });
        }
        const myAdminIndex = teamData.admin.findIndex(admin => admin.email === account.email);
        if (myAdminIndex === -1) {
            return res.status(400).json({ message: 'Only Admin can remove a member of the team' });
        }
        const adminIndex = teamData.admin.findIndex(admin => admin.email === memberEmail);
        if (adminIndex === -1) {
            return res.status(404).json({ message: 'Account with this email does not exist' });
        }
        teamData.admin.splice(adminIndex, 1);
        const {_id} = await accountModel.findOne({email: memberEmail})
        if(memberEmail !== account.email){
            await saveNotifications(`You have been removed from Team ${req.body.team} by ${account.name}`, 'team', _id);
        }
        await teamData.save();
        return res.status(200).send('Admin Removed Successfully')
    } catch (error) {
        return res.status(500).send({error: 'Server Error'});
    }
})

Router.patch('/team/endpoint/exitTeam', auth, async (req, res) => {
    try {
        const account = req.user
        const { team } = req.body; 
        if(!account){
            return res.status(404).send({message: "We couldn't find your account"})
        }
        const teamData = await teamModel.findOne({team,
            $or: [
                { "admin.email": account.email },
                { "members.email": account.email }
            ]
        })
        if (!teamData) {
            return res.status(404).json({ message: 'Team does not exist' });
        }
        
        const adminIndex = teamData.admin.findIndex(admin => admin.email === account.email);
        if (adminIndex !== -1) {
            teamData.admin.splice(adminIndex, 1);
        }

        const memberIndex = teamData.members.findIndex(member => member.email === account.email);
        if (memberIndex !== -1) {
            teamData.members.splice(memberIndex, 1);
        }

        await teamData.save();
        return res.status(200).send('You have successfully exited the team')
    } catch (error) {
        return res.status(500).send({error: 'Server Error'})
    }
})

module.exports = Router