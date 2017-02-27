import http from 'http';
import socketio from 'socket.io';
import socketioJwt from 'socketio-jwt';
import jwt from 'jsonwebtoken';
import Path from 'path';
import parallel from 'async/parallel';
import ss from 'socket.io-stream';
import enableDestroy from 'server-destroy';

import {
    MetadataDatabase
} from './';
import logger from './logger.js';

const SECRET = 'RY0Z][#d3.U6%`<20e]rdbKw10%QK2EWlyf2WoKWD%G"5?4\'<9i=dm5X2yZ!Scy';

class SocketServer {
    constructor(options = {}) {
        options = Object.assign({
            port: 7968,
            hostname: 'localhost',
            root: '/tmp'
        }, options);
        logger.info('Starting socket server...');

        this.root = options.root;
        this.MetadataDatabase = new MetadataDatabase();
        this.httpServer = http.createServer();
        this.io = new socketio(this.httpServer, {
            serveClient: false
        });

        this.httpServer.listen(options.port, options.hostname);
        enableDestroy(this.httpServer);
        this.io
            .on('connection', this.registerDefaultListeners)
            .on('connection', socketioJwt.authorize({
                secret: SECRET,
                timeout: 15000 // 15 seconds to send the authentication message
            }))
            .on('authenticated', this.registerAuthenticatedListeners.bind(this));
    }

    registerDefaultListeners(socket) {
        logger.debug('Client connected!', socket.handshake.address);
        socket
            .on('retrieveToken', function(payload, cb) {
                // TODO: Real user authentication
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
        let _self = this;
        logger.trace('Client authenticated!', JSON.stringify(socket.decoded_token));
        socket
            .on('file.metadata', (path, weight, cb) => {
                if (typeof path !== 'string' && typeof path !== 'object')
                    return cb('First argument {path} is not of type string or type object');
                if (typeof cb !== 'function' && typeof weight !== 'function')
                    return cb('Second/Third argument {cb} is not of type function');

                // Make weight an optional parameter
                if (typeof weight === 'function') {
                    cb = weight;
                    weight = 'slim';
                }

                // Handle weight
                let projection = {};
                switch (weight) {
                    case 'slim':
                        Object.assign(projection, {
                            'metadata.scaled.180': 0
                        });
                        break;
                }

                if (Array.isArray(path)) {
                    let queries = [];
                    for (let p of path) {
                        queries.push((done) => {
                            _self.MetadataDatabase.get(Path.join(_self.root, p), (err, file) => {
                                if (err)
                                    return done(err);

                                file = file.sanitized;

                                // Extra sanitation
                                file.path = p;
                                delete file.history;

                                done(null, file);
                            }, true, projection);
                        });
                    }
                    return parallel(queries, (err, files) => {
                        if (err) {
                            logger.warn('Failed to run file.metadata:', err);
                            return cb(err.message || err);
                        }

                        cb(err, files)
                    });
                }

                _self.MetadataDatabase.get(Path.join(_self.root, path), (err, file) => {
                    if (err) {
                        logger.warn('Failed to run file.metadata:', err);
                        return cb(err.message || err);
                    }

                    file = file.sanitized;

                    // Extra sanitation
                    file.path = path;
                    delete file.history;

                    cb(null, file);
                }, true, projection);
            });
        ss(socket)
            .on('file.read', (stream, path, options) => {
                options = Object.assign({
                    start: 0
                }, options);

                _self.MetadataDatabase.get(Path.join(_self.root, path), (err, file) => {
                    if (err) {
                        logger.error(err);
                        return stream.end('ERROR' + err.message, 'utf8');
                    }

                    file.openStream((err, readStream) => {
                        if (err) {
                            logger.error(err);
                            return stream.end('ERROR' + err.message, 'utf8');
                        }
                        readStream.pipe(stream);
                    }, options);
                });
            });
    }

    close(cb = () => {}) {
        let _self = this;
        parallel([
            (done) => this.io.close(() => {
                logger.debug('Socket server closed');
                done();
            }),
            (done) => {
                _self.httpServer.close(() => {
                    logger.debug('HTTP server closed');
                    done();
                });
                _self.httpServer.destroy();
            },
            (done) => this.MetadataDatabase.close(done)
        ], cb);


    }
}

export default SocketServer;
