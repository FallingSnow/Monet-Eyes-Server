import fs from 'fs-extra';
import Path from 'path';
import PackageConfig from '../../package.json';
import parallel from 'async/parallel';
import ReadDir from "readdir-plus";
import File from './file.js';

let DIR = {
    list: function(path, cb) {
        if (typeof cb !== 'function')
            return console.log('Callback function was not provided.');
        if (typeof path !== 'string')
            return cb('First argument [path] must be of type string.');
        ReadDir(Path.join(PackageConfig.rootDirectory, path), {
            recursive: false,
            filter: {
                directory: true
            }
        }, function(err, files) {
            if (err)
                return cb(err);

            // Remove hidden files
            for (let fileIndex in files) {
                if (files[fileIndex].basename.startsWith('.'))
                    files.splice(fileIndex, 1);
            }

            let identificationTasks = [];
            files.forEach(function(file, i) {

                // Change absolute path to relative to root
                file.path = '/' + Path.relative(PackageConfig.rootDirectory, file.path);

                if (file.type === 'file' && file.extension === '.flif') {
                    identificationTasks.push(function(callback) {
                        File.identifyFlif(file.path, function(err, dimensions) {
                            Object.assign(file, dimensions);
                            callback(err);
                        })

                    });
                }
            });

            parallel(identificationTasks,
                function(err) {
                    cb(err, files);
                });
        });
    }
};

export default DIR;
