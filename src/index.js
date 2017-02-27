import PackageConfig from '../package.json';
import Server from './server.js';

let server;

function init() {
    server = new Server({
        host: 'localhost',
        port: PackageConfig.port,
        directory: PackageConfig.rootDirectory
    });
}
init();

if (module.hot) {
    module.hot.accept('./server.js', () => {
        server.close(init);
    });
}
