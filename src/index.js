const express = require('express')
const http = require('http')
const path = require('path')
const socketio = require('socket.io')
const Filter = require('bad-words')
const { generateMessage, generateLocation } = require('./utils/messages.js')
const { addUser, removeUser, getUser, getUsersInRoom } = require('./utils/users.js')

const app = express()
// express + socket io не могут использоваться вместе, поэтому нужно делать так
const server = http.createServer(app)
// io expect raw http server
const io = socketio(server)

const port = process.env.PORT || 3000
const publicDirectoryPath = path.join(__dirname, '../public')

app.use(express.static(publicDirectoryPath))

//let count = 0

io.on('connection', (socket) => {
    console.log('New Websocket connection')
    // socket.emit('countUpdated', count)
    // socket.on('increment', () => {
    //     count++
    //     // socket emit - show text only for THE user
    //     // io emit - show text to everyone 
    //     //socket.emit('countUpdated', count)
    //     io.emit('countUpdated', count)
    // })
    socket.on('join', (options, cb) => {
        const { error, user } = addUser({ id: socket.id, ...options})

        if (error) {
            return cb(error)
        }

        socket.join(user.room)

        socket.emit('message', generateMessage('Admin', 'Welcome'))
        // text will shows to everyone except THE user
        socket.broadcast.to(user.room).emit('message', generateMessage('Admin', `${user.username} has joined!`))
        io.to(user.room).emit('roomData', {
            room: user.room,
            users: getUsersInRoom(user.room)
        })
        cb()
    })


    socket.on('sendMessage', (message, cb) => {
        const filter = new Filter()
        const user = getUser(socket.id)
        if (filter.isProfane(message)) {
            return cb('Profanity is not allowed')
        }
        
        io.to(user.room).emit('message', generateMessage(user.username, message))
        cb()
    })

    socket.on('send-location', (coords, cb) => {
        const user = getUser(socket.id)
        io.to(user.room).emit('locationMessage', generateLocation(user.username, `https://google.com/maps?q=${coords.latitude},${coords.longitude}`))
        cb()
    })

    socket.on('disconnect', () => {
        const user = removeUser(socket.id)

        if (user) {
            io.to(user.room).emit('message', generateMessage('Admin', `A ${user.username} has left`))
            io.to(user.room).emit('roomData', {
                room: user.room,
                users: getUsersInRoom(user.room)
            })
        }
    })
})

// express + socket io не могут использоваться вместе, поэтому нужно делать так
server.listen(port, () => {
    console.log(`Server is up on ${port}`)
})
