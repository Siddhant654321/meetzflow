const express = require('express')
const Router = express.Router();
const accountModel = require('../Models/accountModel');
const getToken = require('../token')
const mongoose = require('../../mongoose')
const bcrypt = require('bcrypt');
const auth = require('../middleware/auth');
const scheduleModel = require('../Models/scheduleModel');
const meetingModel = require('../Models/meetingModel')
const multer = require('multer');
const sharp = require('sharp');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const sgMail = require('@sendgrid/mail');
const verificationEmail = require('../EmailTemplate/verificationEmail')
const forgotPassword = require('../EmailTemplate/forgotPassword')
const saveNotifications = require('../saveNotifications');

Router.post('/account/endpoint/newSignUp', async (req, res) => {
    try {
        const _id = new mongoose.Types.ObjectId();
        const token = getToken(_id);
        const code = Math.floor(10000000 + Math.random() * 90000000).toString(); 
        const verificationCode = await bcrypt.hash(code, 8);
        const password = await bcrypt.hash(req.body.password, 8)
        const user = await accountModel({_id, ...req.body, password, tokens: [{token}], verificationCode, verificationCodeExpires: Date.now() + 24*60*60*1000 }).save();
        sgMail.setApiKey(process.env.SENDGRID_API_KEY);
        const msg = {
            to: user.email,
            from: 'admin@meetzflow.com',
            subject: 'Verify Your Email - MeetzFlow',
            text: `Please verify your email address to get access to features like team collaboration and meeting scheduling - https://meetzflow.com/verify/${code}/${user.email}`,
            html: verificationEmail(code, user.email, user.name)
        };
        sgMail.send(msg);
        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + 30);
        res.cookie('token', token, {
            httpOnly: true,
            expires: expirationDate,
            sameSite: 'Lax'
        })
        return res.status(201).send({message: 'Account Created Successfully!'})
    } catch (error) {
        res.status(400).send({error})
    }
})

Router.get('/endpoint/verifyEmail/:code/:email', async (req, res) => {
    try {
        const { code, email } = req.params;
        let user = await accountModel.findOne({ email });

        if(!user) {
            return res.status(400).send({error: 'User not found'});
        }

        if(user.status === 'active'){
            return res.status(400).send({error: 'Your Account is already verified'})
        }

        if(!user.verificationCode){
            return res.status(200).send({expired: 'Verification code expired'})
        }
        const isMatch = await bcrypt.compare(code, user.verificationCode);

        if(isMatch) {
            if(Date.now() <= user.verificationCodeExpires){
                user.status = 'active';
                user.verificationCode = undefined;
                user.verificationCodeExpires = undefined;
                await user.save();
                return res.send({success: 'Email verified successfully'});
            }
            else{
                user.status = 'deletedCode';
                user.verificationCode = undefined;
                user.verificationCodeExpires = undefined;
                await user.save();
                return res.status(200).send({expired: 'Verification code expired'});
            }
        } else {
            return res.status(400).send({error: 'Invalid verification code'});
        }
    } catch (error) {
        res.status(500).send({error: 'Server Error'})
    }
});

Router.post('/endpoint/account/newVerificationCode', async (req,res) => {
    try {
        const code = Math.floor(10000000 + Math.random() * 90000000).toString(); 
        const verificationCode = await bcrypt.hash(code, 8);
        let user = await accountModel.findOne({ email: req.body.email });
        if (!user) {
            return res.status(404).send({ error: 'User Not Found With This Email'});
        }
        if(user.status === 'active'){
            return res.status(400).send('Email is already verified')
        }
        user.verificationCode = verificationCode;
        user.status = 'pending'
        user.verificationCodeExpires = Date.now() + 24*60*60*1000
        sgMail.setApiKey(process.env.SENDGRID_API_KEY);
        const msg = {
            to: user.email,
            from: 'admin@meetzflow.com',
            subject: 'Verify Your Email - MeetzFlow',
            text: `Please verify your email address to get access to features like team collaboration and meeting scheduling - https://meetzflow.com/verify/${code}/${user.email}`,
            html: verificationEmail(code, user.email, user.name)
        };
        sgMail.send(msg);
        await accountModel(user).save();
        res.status(201).send({success: 'Email Sent Successfully'})
    } catch (error) {
        res.status(500).send('Server Error')
    }
})

Router.post('/endpoint/account/forgot-password', async (req,res) => {
    try{
        const user = await accountModel.findOne({ email: req.body.email })
        if(!user){
            return res.status(400).send({error: 'Account with this email not Found'})
        }
        const code = Math.floor(10000000 + Math.random() * 90000000).toString(); 
        const forgotPasswordCode = await bcrypt.hash(code, 8);
        user.forgotPasswordCode = forgotPasswordCode;
        user.forgotPasswordCodeExpires = Date.now() + 24*60*60*1000
        sgMail.setApiKey(process.env.SENDGRID_API_KEY);
        const msg = {
            to: user.email,
            from: 'admin@meetzflow.com',
            subject: 'Change Your Password - MeetzFlow',
            text: `Please follow this link to set a new password - https://meetzflow.com/change-password/${code}/${user.email}`,
            html: forgotPassword(code, user.email)
        };
        sgMail.send(msg);
        await accountModel(user).save();
        res.status(201).send({success: 'Email Sent Successfully'})
    } catch (error) {
        res.status(500).send({error: 'Server Error Occured'})
    }
});

Router.patch('/endpoint/change-password/:code/:email', async (req, res) => {
    try {
        const { code, email } = req.params;
        let user = await accountModel.findOne({ email });

        if(!user) {
            return res.status(400).send({error: 'User not found'});
        }

        if(!user.forgotPasswordCode){
            return res.status(400).send({expired: 'Verification code expired. Please request a new one by heading to Login page and clicking on Forgot Password Link.'})
        }

        const isMatch = await bcrypt.compare(code, user.forgotPasswordCode);

        if(isMatch) {
            if(Date.now() <= user.forgotPasswordCodeExpires){
                const password = await bcrypt.hash(req.body.password, 8);
                const token = getToken(user._id)
                user.tokens.push({token})
                user.password = password;
                user.forgotPasswordCode = undefined;
                user.forgotPasswordCodeExpires = undefined;
                await user.save();
                await saveNotifications('You have changed your password', 'profile', req.userId);
                const expirationDate = new Date();
                expirationDate.setDate(expirationDate.getDate() + 30);
                res.cookie('token', token, {
                    httpOnly: true,
                    expires: expirationDate,
                    sameSite: 'Lax'
                })
                return res.send({success: 'Password Changed successfully', name: user.name, email: user.email});
            }
            else{
                user.forgotPasswordCode = undefined;
                user.forgotPasswordCodeExpires = undefined;
                await user.save();
                return res.status(400).send({error: 'Password reset link has expired'});
            }
        } else {
            return res.status(400).send({error: 'Invalid verification code'});
        }
    } catch (error) {
        res.status(500).send({error: 'Server Error'})
    }
});

Router.post('/account/endpoint/login', async (req, res) => {
    try {
        const user = await accountModel.findOne({email: req.body.email})
        if(await bcrypt.compare(req.body.password, user.password)){
            const {status} = user;
            if(status !== 'active'){
                return res.status(400).send({emailError: 'Your email is not verified. Please verify it before performing any action'})
            }
            const token = getToken(user._id)
            user.tokens.push({token})
            const expirationDate = new Date();
            expirationDate.setDate(expirationDate.getDate() + 30);
            res.cookie('token', token, {
                httpOnly: true,
                expires: expirationDate,
                sameSite: 'Lax'
            })
            await user.save()
            return res.status(201).send({name: user.name, email: user.email, isGoogleConnected: user.googleAuthorizationCode ? true : false})
        }
        throw new Error()
    } catch (error) {
        res.status(400).send({error: 'Either email or password is wrong'})
    }
});

const storage = multer.diskStorage({
    destination: `./avatars/`,
    filename: function (req, file, cb) {
        crypto.pseudoRandomBytes(16, function (err, raw) {
          if (err) return cb(err);
          cb(null, raw.toString('hex') + path.extname(file.originalname));
        });
    }
});

const upload = multer({storage: storage});


Router.patch('/account/endpoint/update', auth, upload.single('avatar'), async (req, res) => {
      try {
        const updates = Object.keys(req.body);
        const allowedUpdates = ['name','role', 'password', 'avatar', 'organization'];
  
        if (updates.includes('email')) {
          return res.status(400).send({ error: 'Email cannot be changed.'});
        }
  
        if (updates.includes('password')) {
          req.body.password = await bcrypt.hash(req.body.password, 8);
        }
  
        const isValidOperation = updates.every((update) =>
          allowedUpdates.includes(update)
        );
  
        if (!isValidOperation) {
          return res.status(400).send({ error: 'Invalid updates!' });
        }

        updates.forEach((update) => (req.user[update] = req.body[update]));
        
        if (req.file) {
            
            const inputPath = req.file.path;
            if (!fs.existsSync(`./avatars/${req.user.email}`)) {
                fs.mkdirSync(`./avatars/${req.user.email}`);
            }
            const outputPath = `./avatars/${req.user.email}/compressed_${req.file.filename}`;
            try {
            await sharp(inputPath)
                .resize(250, null, { 
                    withoutEnlargement: true,  
                    fit: 'inside'  
                })
                .jpeg()
                .toFile(outputPath);
        
            fs.unlinkSync(inputPath);
            req.user.avatar = `compressed_${req.file.filename}`;
            
            
            } catch (error) {
                res.status(500).send({error: "Server error"})
            }
        }

        await req.user.save();
        if (updates.includes('password')){
            await saveNotifications('You have changed your password', 'profile', req.userId);
        } else {
            await saveNotifications('You have changed your account details', 'profile', req.userId);
        }

        if(req.file){
            fs.readdir(`./avatars/${req.user.email}`, (err, files) => {
                if (err) {
                    return res.status(500).send({error: 'Server Error'})
                }
            
                files.forEach((file) => {
                    
                if (file !== `compressed_${req.file.filename}`) {
                    const filePath = path.join(`./avatars/${req.user.email}`, file);
            
                    try {
                        fs.unlinkSync(filePath);
                    } catch (err) {
                        return res.status(500).send({error: 'Server Error'})
                    }

                }
                });
            });
        }
  
        res.send({success: "Detail updated Successfull"});
        
      } catch (error) {
        res.status(500).send({error: 'Server Error'});
      }
    },
    (error, req, res, next) => {
      res.status(400).send({ error: error.message });
    }
);

Router.delete('/account/endpoint/delete', auth, async (req, res) => {
    try {
        const {email} = await accountModel.findByIdAndDelete(req.userId);
        await scheduleModel.deleteMany({userId: req.userId})
        await meetingModel.deleteMany({email})
        const avatarDir = path.join(__dirname, `../../avatars/${email}`)
        if (fs.existsSync(avatarDir)) {
            if (fs.statSync(avatarDir).isDirectory()) {
              fs.readdirSync(avatarDir).forEach(function(file) {
                const curPath = avatarDir + '/' + file;
                if (fs.lstatSync(curPath).isDirectory()) {
                  deleteFolderIfExists(curPath);
                } else {
                  fs.unlinkSync(curPath);
                }
              });
              fs.rmdirSync(avatarDir);
            } 
          } 
        res.clearCookie('token');
        res.status(200).send({result: 'Account Deleted Successfully'})
    } catch (error) {
        res.status(500).send({result: 'Account Deletion Failed'})
    }
})

Router.get('/account/endpoint/logout', auth, async (req, res) => {
    try{
        const token = req.cookies.token;
        req.user.tokens.forEach((value, index) => {
            if(value.token == token){
                req.user.tokens.splice(index, 1);
            }
        })
        await req.user.save();
        res.clearCookie('token');
        res.status(200).send({result: 'Account logged out successfully'})
    } catch (error) {
        res.status(500).send({result: 'Unable to logout'})
    }
})
Router.get('/account/endpoint/logout-everyone', auth, async (req, res) => {
    try {
        req.user.tokens = [];
        await req.user.save()
        res.clearCookie('token');
        res.status(200).send({result: 'All devices are logged out from this account'})
    } catch (error) {
        res.status(500).send({result: 'Server Error'})
    }
})

Router.get('/account/endpoint/notifications', auth, async (req, res) => {
    
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 5;
    const skip = (page - 1) * limit;

    try {

        if (req.user.notifications.length === 0) {
            return res.status(200).send({ noNotification: "You have no new notifications" });
        }

        const sortedNotifications = req.user.notifications.sort((a, b) => b.time - a.time);
        const paginatedNotifications = sortedNotifications.slice(skip, skip + limit);

        return res.status(200).send({notifications: paginatedNotifications});
    } catch (error) {
        res.status(500).send({error})
    }
})

Router.get('/account/endpoint/:email', async (req, res) => {
    try {
        const user = await accountModel.findOne({email: req.params.email.toLowerCase()})
        if(user === null){
            return res.status(404).send('No User with this email Exist')
        }
        const {name, email, organization = null, role = null, avatar = null} = user
        res.send({name, email, organization, role, avatar})
    } catch (error) {
        res.status(500).send({error: 'Server Error'})
    }
})

Router.get('/avatars/:email/:image', (req, res) => {
    try {
        res.sendFile(path.join(__dirname, `../../avatars/${req.params.email}/${req.params.image}`))
    } catch (error) {
        res.status(404).send('Image Not Found')
    }
})

module.exports = {AccountRouter: Router};