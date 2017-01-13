import http from 'http';
import fs from 'fs';
import socketio from 'socket.io';
import socketioJwt from 'socketio-jwt';
import jwt from 'jsonwebtoken';
import {
    Directory,
    File
} from './';
const SECRET = 'RY0Z][#d3.U6%`<20e]rdbKw10%QK2EWlyf2WoKWD%G"5?4\'<9i=dm5X2yZ!Scy';

class SocketServer {
    constructor(options) {
        console.log('Starting socket server...');
        this.httpServer = http.createServer();
        this.io = socketio(this.httpServer);
        this.httpServer.listen(options.port);
        this.io.on('connection', this.registerDefaultListeners);
        this.io.on('connection', socketioJwt.authorize({
            secret: SECRET,
            timeout: 15000 // 15 seconds to send the authentication message
        })).on('authenticated', this.registerAuthenticatedListeners);
    }

    registerDefaultListeners(socket) {
        console.log('Client connected!', socket.handshake.address);
        socket
            .on('retrieveToken', function(payload, cb) {
                if (payload.user === 'test' && payload.password === 'password') {
                    let token = jwt.sign({
                        user: payload.user,
                        address: socket.handshake.address
                    }, SECRET, {
                        expiresIn: 5 * 60 * 1000 // Expires in 5 hours
                    });
                    cb(null, token);
                } else {
                    cb('INVALID');
                }
            });
    }

    registerAuthenticatedListeners(socket) {
        console.log('Client authenticated!', JSON.stringify(socket.decoded_token));
        socket
            .on('listDirectory', Directory.list)
            .on('fileSize', File.size)
            .on('fileRead', File.read)
            .on('fileInfo', File.info)
            .on('thumbnail', File.thumbnail);
    }

    close(cb) {
        console.log('Closing socket server...');
        let _self = this;
        this.io.close(function() {
            _self.httpServer.close(cb);
        });
    }
}

export default SocketServer;
