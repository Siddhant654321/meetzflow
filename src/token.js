const jwt = require('jsonwebtoken');

const getToken = (_id) => {
    const token = jwt.sign({_id}, process.env.JWT_SECRET);
    return token;
}

module.exports = getToken;