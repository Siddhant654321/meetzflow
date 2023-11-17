const teamModel = require('./Models/teamModel');
const accountModel = require('./Models/accountModel')
const moment = require('moment-timezone');

const saveMultipleNotifications = async (notification, criteria, emails) => {
    const time = moment().tz("America/Los_Angeles").format();
    const data = {notification,criteria,time};
    await accountModel.updateMany({ email: { $in: emails } }, { $push: { notifications: data } });
}


module.exports = saveMultipleNotifications;