const express = require('express')
const app = express();
const {AccountRouter} = require('./src/Routers/account.js') 
const ScheduleRouter = require('./src/Routers/schedule.js')
const meetingsRouter = require('./src/Routers/meetings.js')
const teamRouter = require('./src/Routers/team.js')
const chatRouter = require('./src/Routers/chat.js')
const {AuthRouter} = require('./src/Routers/google-auth.js')
const cors = require('cors');
const emailModify = require('./src/middleware/emailModify.js');
const server = require('http').createServer(app);
const accountModel = require('./src/Models/accountModel.js');
const teamModel = require('./src/Models/teamModel.js');
const contactRouter = require('./src/Routers/contact.js');
const cookieParser = require('cookie-parser');
const path = require('path')


const corsOptions = {
    origin: 'https://meetzflow.com', 
    credentials: true
};
const io = require('socket.io')(server, {cors: corsOptions})
app.options('*', cors(corsOptions));
app.use(cors(corsOptions))
app.use(cookieParser())

app.use(express.json())
app.use(emailModify)
app.use(AccountRouter)
app.use(AuthRouter)
app.use(ScheduleRouter)
app.use(meetingsRouter)
app.use(teamRouter)
app.use(chatRouter)
app.use(contactRouter)
app.use(express.static(path.join(__dirname, 'build')));

app.get('/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'))
})

let onlineUsers = []

io.on('connection', async (socket) => {
  let team;
  let accountName;
  const {teamName, userEmail} = socket.handshake.query
  try{
    const user = (await accountModel.findOne({email: userEmail}));
    const {_id} = user;
    accountName = user.name;
    team = await teamModel.findOne({team: teamName,
      $or: [
          { "admin.email": userEmail },
          { "members.email": userEmail }
      ]
    })
    if(!team){
      throw new Error('Team not found')
    }
    socket.join(String(team._id));
    onlineUsers.push({email: userEmail, teamId: String(team._id)})
  } catch (error) {
    socket.emit('error', 'Team Not Found')
    socket.disconnect()
    return; 
  }

  const emails = onlineUsers.filter(value => {
    if(value.teamId === String(team._id)){
      return value.email
    }
  })
  
  io.to(String(team._id)).emit('newOnline', emails);

  socket.on('sendImage', (data) => {
    const images = {image: data, from: accountName}
    socket.to(String(team._id)).emit('receiveImage', images);
  });
  
  socket.on('sendMessage', data => {
    const message = {message: data, from: accountName}
    socket.to(String(team._id)).emit('receiveMessage', message)
  })

  socket.on('sendMeetingMessage', data => {
    const message = {...data, from: accountName}
    socket.to(String(team._id)).emit('receiveMeetingMessage', message)
  })

  socket.on('disconnect', () => {
    onlineUsers = onlineUsers.filter(user => user.email !== userEmail);
    const emails = onlineUsers.filter(value => {
      if(value.teamId === String(team._id)){
        return value.email
      }
    })
    io.to(String(team._id)).emit('newOffline', emails);
  })
});


server.listen(3000, () => {
    console.log('Server is started')
})
