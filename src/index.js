import PackageConfig from '../package.json';
import Server from './server.js';

let server;

function init() {
    server = new Server({
        port: PackageConfig.port
    });
}
init();

if (module.hot) {
    module.hot.accept('./server.js', () => {
        server.close(init);
    });
}
