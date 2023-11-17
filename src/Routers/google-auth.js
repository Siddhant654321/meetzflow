const express = require('express');
const { google } = require('googleapis');
const auth = require('../middleware/auth');

const Router = express.Router();

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.NODE_ENV === 'production' ? 'https://meetzflow.com/api/setup/callback' : 'http://localhost:3000/api/setup/callback';

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const SCOPES = ['https://www.googleapis.com/auth/calendar.events'];

Router.get('/auth/google', auth, (req, res) => {
  if(req.user.googleAuthorizationCode){
    return res.status(400).send('Your Google Calendar Account is already connected')
  }
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  res.redirect(url);
});


Router.get('/api/setup/callback', auth, async (req, res) => {
    const { code } = req.query;
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    try {
        if(req.user.googleAuthorizationCode){
            return res.status(400).send('Your Google Calendar Account is already connected')
        }
        req.user.googleAuthorizationCode = {...tokens}
        await req.user.save();
        res.redirect(process.env.NODE_ENV === 'production' ? 'http://meetzflow.com/app/setup/?success=success' : 'http://localhost:3001/app/setup/?success=success');
    } catch(error) {
        res.status(500).send('Authentication failed');
    }
});

Router.get('/api/user/is-google-auth', auth, async (req, res) => {

    try{
      if(!req.user.googleAuthorizationCode){ 
          return res.status(400).send('Your Google Calendar Account is not connected')
      } else { 
          res.send('Your Google Calendar Account is already connected')
      }
    } catch(error){
      res.status(500).send('Server Error')
    }
})

module.exports = {AuthRouter: Router};