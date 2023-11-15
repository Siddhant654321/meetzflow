const { google } = require('googleapis');

const getOAuthClient = (tokenData) => {

    const CLIENT_ID = process.env.CLIENT_ID;
    const CLIENT_SECRET = process.env.CLIENT_SECRET;
    const REDIRECT_URI = process.env.NODE_ENV === 'production' ? 'http://meetzflow.com/api/setup/callback' : 'http://localhost:3001/api/setup/callback';
  
    const oauth2Client = new google.auth.OAuth2(
      CLIENT_ID,
      CLIENT_SECRET,
      REDIRECT_URI
    );
  
    oauth2Client.setCredentials({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      scope: tokenData.scope,
      token_type: tokenData.token_type,
      expiry_date: tokenData.expiry_date
    });
  
    return oauth2Client;
}

module.exports = getOAuthClient;