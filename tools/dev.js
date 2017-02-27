#!/bin/env node

const path = require('path');
const os = require('os');
const spawn = require('child_process').spawn;

const PackageConfig = require('../package.json');
const dir = path.resolve(__dirname, '../');
const blessed = require('blessed');
// const nodemon = require('nodemon');
// const webpack = require("webpack");

const screen = blessed.screen({
    smartCSR: true
});

const buildLog = blessed.log({
    parent: screen,
    top: '0',
    left: '0',
    width: '100%',
    height: '100%-1',
    content: 'Loading...',
    label: 'Build Log',
    // Allow mouse support
    mouse: true,
    // Allow key support (arrow keys + enter)
    keys: true,
    // Use vi built-in keys
    vi: true,
    border: {
        type: 'line'
    },
});
const buildLogButton = blessed.button({
    parent: screen,
    bottom: 0,
    left: 0,
    mouse: true,
    keys: true,
    shrink: true,
    padding: {
        left: 1,
        right: 1
    },
    name: 'Build [F1]',
    content: 'Build [F1]',
    style: {
        focus: {
            bg: 'red'
        },
        hover: {
            bg: 'red'
        }
    }
});
buildLogButton.on('press', () => {
    buildLog.show();
    buildLog.focus();
    buildLogButton.style.bold = true;
    runLogButton.style.bold = false;
    runLog.hide();
    screen.render();
});

const runLog = blessed.log({
    parent: screen,
    top: '0',
    left: '0',
    width: '100%',
    height: '100%-1',
    content: 'Loading...',
    label: 'Run Log',
    // Allow mouse support
    mouse: true,
    // Allow key support (arrow keys + enter)
    keys: true,
    // Use vi built-in keys
    vi: true,
    border: {
        type: 'line'
    },
    hidden: true
});
runLog.key('r', (ch, key) => {
    runProcess.stdin.write('rs');
});
const runLogButton = blessed.button({
    parent: screen,
    bottom: 0,
    left: buildLogButton.content.length + 2,
    mouse: true,
    keys: true,
    shrink: true,
    padding: {
        left: 1,
        right: 1
    },
    name: 'Run [F2]',
    content: 'Run [F2]',
    style: {
        focus: {
            bg: 'red'
        },
        hover: {
            bg: 'red'
        }
    }
});
runLogButton.on('press', () => {
    runLog.show();
    runLog.focus();
    buildLogButton.style.bold = false;
    runLogButton.style.bold = true;
    buildLog.hide();
    screen.render();
});

screen.key('f1', () => buildLogButton.press());
screen.key('f2', () => runLogButton.press());

buildLogButton.press();

// Render the screen.
screen.render();

let runStarted = false,
    buildProcess, runProcess;

screen.key(['escape', 'q', 'C-c'], function(ch, key) {
    buildLog.log('Attempting to close...');
    screen.render();
    if (buildProcess)
        buildProcess.kill('SIGINT');
    if (runProcess)
        runProcess.kill('SIGINT');
});

function build() {
    return new Promise(function(resolve, reject) {

        // const compiler = webpack(require('../webpack.config.babel.js'));
        //
        // buildProcess = compiler.watch({}, (err, stats) => {
        //     if (err)
        //         return buildLog.log(err);
        //
        //     buildLog.log(stats);
        //     screen.render();
        // });
        //
        // buildProcess.end = () => {
        //     buildProcess.close(() => {
        //         resolve();
        //     });
        // }

        buildProcess = spawn('node_modules/.bin/cross-env', ['NODE_ENV=development', 'node_modules/.bin/webpack', '--watch', '--progress'], {
            cwd: dir
        });

        buildProcess.stdout.on('data', (data) => {
            const string = data.toString();
            if (!runStarted)
                if (data.toString().startsWith('Hash')) {
                    runStarted = true;
                    resolve();
                }
            buildLog.log(string);
            screen.render();
        });

        buildProcess.stderr.on('data', (data) => {
            // buildLog.popLine();
            buildLog.log(data.toString());
            screen.render();
        });

        buildProcess.on('close', (code, signal) => {
            buildLog.log('Build Closed!');
            buildLog.log(`Build process exited with code ${code} and signal ${signal}`);
            screen.render();
            if (code !== 0)
                reject(code);
        });
    });
}

function run() {
    return new Promise(function(resolve, reject) {
        const bundleFile = path.join(os.tmpdir(), PackageConfig.name, 'bundle.js');

        // nodemon({
        //     script: '--inspect ' + bundleFile + ' --color',
        //     watch: [bundleFile],
        //     stdout: false
        // });
        //
        // nodemon
        //     .on('start', function() {
        //         runLog.log('App has started');
        //         screen.render();
        //     })
        //     .on('log', (type, plain, color) => {
        //         runLog.log(plain);
        //         screen.render();
        //     })
        //     .on('quit', function() {
        //         runLog.log('App has quit');
        //         screen.render();
        //         resolve();
        //     })
        //     .on('restart', function(files) {
        //         runLog.log('App restarted due to: ', files);
        //         screen.render();
        //     });


        runProcess = spawn('node_modules/.bin/cross-env', ['NODE_ENV=development', 'nodemon', '--inspect', '--watch', bundleFile, bundleFile, '--colors'], {
            cwd: dir
        });

        runProcess.stdout.on('data', (data) => {
            const string = data.toString();
            runLog.popLine();
            runLog.log(string);
            screen.render();
        });

        runProcess.stderr.on('data', (data) => {
            const string = data.toString();
            runLog.popLine();
            runLog.log(string);
            screen.render();
        });

        runProcess.on('close', (code, signal) => {
            runStarted = false;
            if (runProcess.error) {
                return reject('error')
            }
            runLog.log('Run Closed!');
            runLog.log(`Run process exited with code ${code} and signal ${signal}`);
            screen.render();
            if (code === 0)
                resolve();
            else {
                reject(code);
            }
        });
    });
}

build().then(run).then(() => {
    buildLog.log('Press enter to close...');
    runLog.log('Press enter to close...');
    screen.render();
    screen.key(['escape', 'q', 'C-c', 'enter'], function(ch, key) {
        screen.destroy();
    });
}, (err) => {
    screen.destroy();
    console.log('ERROR:', err);
});
