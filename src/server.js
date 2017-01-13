import {Directory, SocketServer} from './lib';

class Server {
    constructor(options) {
        this.socket = new SocketServer(options);
    }
    close(cb) {
        this.socket.close(cb);
    }
}

export default Server;
