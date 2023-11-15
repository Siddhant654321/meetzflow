const accountModel = require('../Models/accountModel');
const teamModel = require('../Models/teamModel');
const chatModel = require('../Models/chatModel')


const getChat = async (req, res, next) => {
    try {
        const account = await accountModel.findById(req.userId)
        const team = await teamModel.findOne({
            team: req.body.team,
            $or: [
                {'admin.email': account.email},
                {'members.email': account.email}
            ]
        });
        if(team === null){
            return res.status(404).send({noTeam: 'No Such Team Exist'})
        }
        const chat = await chatModel.findOne({teamId: team._id});
        req.chat = chat;
        req.team = team;
        req.account = account;
        next();
    } catch (error) {
        res.status('500').send({error: 'Server Error'})
    }
}

module.exports = getChat;