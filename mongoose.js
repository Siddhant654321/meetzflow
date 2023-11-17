const mongoose = require('mongoose');
const mongo_url = process.env.MONGO;
mongoose.connect(mongo_url)
mongoose.set('runValidators', true);
module.exports = mongoose;