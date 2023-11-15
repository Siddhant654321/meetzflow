const jwt = require('jsonwebtoken');
const accountModel = require('../Models/accountModel')
const mongoose = require('mongoose')

const auth = async (req, res, next) => {
    try {
        const token = req.cookies.token
        const {_id} = jwt.verify(token, process.env.JWT_SECRET);
        if(!mongoose.isValidObjectId(_id)){
            res.clearCookie('token');
            return res.status(401).send({error: 'You are unauthorized to perform this action'})
        }
        req.userId = _id;
        const user_data = await accountModel.findById(_id);
        req.user = user_data;
        const {tokens} = user_data;
        let success = 'failure';
        const {status} = user_data;
        if(status !== 'active'){
            return res.status(400).send({emailError: 'Your email is not verified. Please verify it before performing any action'})
        }
        if(req.path !== '/auth/google' && req.path !== '/api/setup/callback'){
            if(!user_data.googleAuthorizationCode){
                return res.status(400).send({googleAuthenticationError: 'You have not connected google with our app yet. Please do it before performing any action'})
            }
        }
        tokens.forEach((value) => {
            if(value.token === token){
                success = 'success'
            }
        })
        if(success === 'failure'){
            throw new Error()
        }
        return next()
    } catch (error) {
        res.clearCookie('token');
        res.status(401).send({error: 'You are unauthorized to perform this action'})
    }
}

module.exports = auth;