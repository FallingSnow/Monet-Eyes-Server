import {
    SocketServer,
    logger
} from './lib';

class Server {
    constructor(options) {
        this.root = options.directory;
        this.socket = new SocketServer(Object.assign({
            root: this.root
        }, options));
        process.on('SIGINT', this.close.bind(this));
    }
    close(cb) {
        logger.info('Attempting to shutdown server...');
        this.socket.close(cb);
    }
}

export default Server;
