#!/bin/env node

const path = require('path');
const os = require('os');
const spawn = require('child_process').spawn;
const keypress = require('keypress');

const PackageConfig = require('../package.json');
const dir = path.resolve(__dirname, '../');

// make `process.stdin` begin emitting "keypress" events
keypress(process.stdin);

let started = false;

function build() {
    return new Promise(function(resolve, reject) {
        const build = spawn('node_modules/.bin/cross-env', ['NODE_ENV=development', 'node_modules/.bin/webpack', '--watch', '--progress'], {
            cwd: dir
        });

        build.stdout.on('data', (data) => {
            if (!started)
                if (data.toString().startsWith('Hash')) {
                    started = true;
                    run().then();
                }
            console.log(`${data}`);
        });

        build.stderr.on('data', (data) => {
            console.log(`${data}`);
        });

        const shutdown = function() {
            build.kill();
        };

        process.on('SIGINT', shutdown);

        build.on('close', (code) => {
            console.log('Build Closed!');
            console.log(`child process exited with code ${code}`);
            if (code === 0)
                resolve();
            else {
                reject();
            }
        });
    });
}

function run() {
    return new Promise(function(resolve, reject) {
        const bundleFile = path.join(os.tmpdir(), PackageConfig.name, 'bundle.js');
        const run = spawn('node_modules/.bin/nodemon', ['--watch', bundleFile, bundleFile], {
            cwd: dir
        });

        run.stdout.on('data', (data) => {
            console.log(`${data}`);
        });

        run.stderr.on('data', (data) => {
            console.log(`${data}`);
        });

        run.stdin.setEncoding('utf-8');

        const shutdown = function() {
            run.kill();
        };

        process.on('SIGINT', shutdown);

        // listen for the "keypress" event
        process.stdin.on('keypress', function(ch, key) {
            if (key && key.ctrl && key.name == 'c') {
                process.kill(process.pid, 'SIGINT');
                process.stdin.pause();
            }
            if (key && key.name == 'r') {
                run.stdin.write('rs');
            }
        });

        process.stdin.setRawMode(true);
        process.stdin.resume();

        run.on('close', (code) => {
            started = false;
            console.log('Run Closed!');
            console.log(`child process exited with code ${code}`);
            if (code === 0)
                resolve();
            else {
                reject();
            }
        });
    });
}

build().then();
