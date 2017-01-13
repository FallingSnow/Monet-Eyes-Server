import fs from 'fs-extra';
import Path from 'path';
import {
    spawn,
    exec
} from 'child_process';
import os from 'os';
import PackageConfig from '../../package.json';
import Gm from 'gm';
import Flif from 'flif';

const sizeRegex = /\, ([0-9]+)x([0-9]+)\,/;

let FILE = {
    stat: function(path, cb) {
        if (typeof cb !== 'function')
            return console.log('Callback function was not provided.');
        if (typeof path !== 'string')
            return cb('First argument [path] must be of type string.');

        console.log('Getting stats for', Path.join(PackageConfig.rootDirectory, path));
        fs.stat(Path.join(PackageConfig.rootDirectory, path), cb);
    },
    size: function(path, cb) {
        if (typeof cb !== 'function')
            return console.log('Callback function was not provided.');
        if (typeof path !== 'string')
            return cb('First argument [path] must be of type string.');

        console.log('Getting size for', Path.join(PackageConfig.rootDirectory, path));
        FILE.stat(path, function(err, stats) {
            if (err)
                return cb(err);

            cb(err, stats.size);
        });
    },
    read: function(path, bytes, cb) {
        if (typeof cb !== 'function')
            return console.log('Callback function was not provided.');
        if (typeof bytes !== 'number')
            return cb('Second argument [bytes] must be of type number.');
        if (typeof path !== 'string')
            return cb('First argument [path] must be of type string.');

        const filePath = Path.join(PackageConfig.rootDirectory, path);
        console.log('Reading', Path.join(PackageConfig.rootDirectory, path));
        fs.open(filePath, 'r', function(err, fd) {
            if (err) {
                fs.close(fd);
                return cb(err);
            }

            fs.read(fd, Buffer.alloc(bytes), 0, bytes, 0, function(err, bytesRead, buffer) {
                fs.close(fd);
                if (err)
                    return cb(err);

                cb(err, buffer);
            });
        });
    },
    info: function(path, cb) {
        if (typeof cb !== 'function')
            return console.log('Callback function was not provided.');
        if (typeof path !== 'string')
            return cb('First argument [path] must be of type string.');

        let file = {};
        const filePath = Path.join(PackageConfig.rootDirectory, path);
        Object.assign(file, getFilePaths(path));
        console.log('Getting info for', filePath);
        FILE.stat(path, function(err, stat) {
            if (err)
                return cb(err);

            Object.assign(file, {
                stat
            });
            file.type = getType(stat);
            if (path.endsWith('.flif')) {
                FILE.identifyFlif(path, function(err, dimensions) {
                    if (err)
                        return cb(err);

                    Object.assign(file, dimensions);
                    FILE.getPathRealtiveTo(path, [-1, 1], function(err, paths) {
                        if (err)
                            return cb(err);

                        Object.assign(file, {
                            prev: paths[0],
                            next: paths[1],
                        });

                        cb(err, file);
                    })
                });
            } else {
                cb(null, stat);
            }
        });
    },
    thumbnail: function(path, cb) {
        if (typeof cb !== 'function')
            return console.log('Callback function was not provided.');
        if (typeof path !== 'string')
            return cb('First argument [path] must be of type string.');

        const filePath = Path.join(PackageConfig.rootDirectory, path);
        const thumbnailPath = Path.join(PackageConfig.rootDirectory, '.thumbnails', path);
        console.log('Getting thumbnail for', filePath);
        fs.readFile(thumbnailPath, function(err, buffer) {
            if (err) {

                // Thumbnail does not exist, lets create it
                if (err.code === 'ENOENT') {
                    return createThumbnail.flif(filePath, thumbnailPath, function(err) {
                        if (err)
                            return cb(err);

                        FILE.thumbnail(path, cb);
                    });
                } else
                    return cb(err);
            }
            cb(err, buffer);
        });
    },
    identifyFlif: function(path, cb) {
        if (typeof cb !== 'function')
            return console.log('Callback function was not provided.');
        if (typeof path !== 'string')
            return cb('First argument [path] must be of type string.');

        const filePath = Path.join(PackageConfig.rootDirectory, path);
        console.log('Identifying flif', filePath);

        exec('flif --identify ' + filePath, function(err, stdout) {
            if (err)
                return cb(err);

            let matches = sizeRegex.exec(stdout);
            if (!matches)
                return cb(stdout);

            cb(null, {
                width: matches[1],
                height: matches[2]
            });
        });
    },
    // TODO: Allow pos to be array of positions
    getPathRealtiveTo: function(path, positions, cb) {
        if (typeof cb !== 'function')
            return console.log('Callback function was not provided.');
        if (typeof path !== 'string')
            return cb('First argument [path] must be of type string.');
        if (typeof positions !== 'object')
            return cb('Second argument [positions] must be of type object(array).');

        const filePath = Path.join(PackageConfig.rootDirectory, path);
        const directory = Path.dirname(filePath);
        console.log('Getting path(s) at', positions, 'relative to', filePath);

        fs.readdir(directory, (err, paths) => {
            if (err)
                return cb(err);

            // Remove hidden files
            for (let fileIndex in paths) {
                if (paths[fileIndex].startsWith('.'))
                    paths.splice(fileIndex, 1);
            }

            let results = [];
            for (let pathIndex in paths) {
                if ('/' + paths[pathIndex] === path) {
                    let pathPosition = parseInt(pathIndex);
                    for (let pos of positions) {
                        if (typeof paths[pathPosition + pos] === 'undefined') {
                            results.push(null);
                            continue;
                        }

                        results.push(Path.relative(PackageConfig.rootDirectory, Path.join(directory, paths[pathPosition + pos])));
                    }
                }
            }

            cb(null, results);
        });
    }

};

export default FILE;

const createThumbnail = {
    flif: function(input, output, cb) {
        if (typeof cb !== 'function')
            return console.log('Callback function was not provided.');
        if (typeof input !== 'string')
            return cb('First argument [input] must be of type string.');
        if (typeof output !== 'string')
            return cb('Second argument [output] must be of type string.');

        console.log('Creating thumbnail for', input);
        const outputDirectory = Path.dirname(output);

        fs.ensureDir(outputDirectory, function(err) {
            if (err)
                return cb(err);

            //             const decoder = spawn('flif', ['-d', input, '-']).on('error', cb);
            //             const encoder = spawn('flif', ['-e', '-Q20', '-N', '-', output]).on('error', cb);
            //
            //             decoder.stderr.on('data', (data) => {
            //   console.log(`stderr: ${data}`);
            // });
            //             encoder.stderr.on('data', (data) => {
            //   console.log(`stderr: ${data}`);
            // });
            //
            //             Gm(decoder.stdout)
            //                 .resize(300, null) // Resize to width 300 while maintaining aspect ratio
            //                 .quality(0) // Fastest compression
            //                 .stream(function(err, stdout, stderr) {
            //                     if (err)
            //                         return cb(err.Error);
            //
            //                     // stdout.pipe(encoder.stdin);
            //                 })
            //                 .write(output, function(err) {
            //                     if (!err) console.log('done');
            //                 });
            //
            //             encoder.on('close', (code) => {
            //                 console.log("SUCCESS!")
            //             });
            // Create temp file to store the downscaled, non flif encoded image
            makeTempFile(5, 'png', function(err, tempFile) {
                if (err)
                    return cb(err);

                Flif.decode(input, tempFile, function(err, stdout, stderr) {
                    if (err)
                        return cb(err);

                    Gm(tempFile)
                        .resize(null, 180) // Resize to width 300 while maintaining aspect ratio
                        .quality(0) // Fastest compression
                        .write(tempFile, function(err) {

                            if (err)
                                return cb(err.Error);

                            Flif.encode(tempFile, output, ['-Q'+PackageConfig.thumnail.quality, '-N'], function(err, stdout, stderr) {
                                if (err)
                                    return cb(err);

                                fs.remove(tempFile, function(err) {
                                    if (err) console.log(err);
                                });

                                cb(err);
                            });
                        });
                });
            });
        });
    }
}

const charmap = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const tempDir = os.tmpdir();

function makeTempFile(length, extension, cb) {
    let path, counter = 0;
    do {
        counter++;
        let base = '';
        for (let i = 0; i < length; i++) {
            base += charmap[Math.floor(Math.random() * charmap.length)];
        }
        path = tempDir + '/' + base + '.' + extension;
    } while (fs.existsSync(path) && counter < 10);

    if (fs.existsSync(path))
        return cb('Failed to generate temp filename.');

    cb(null, path);
}

function getFilePaths(path) {
    const parsed = Path.parse(path);
    return {
        basename: parsed.name,
        extension: parsed.ext,
        name: parsed.base,
        path: path,
        relativePath: parsed.base
    };
}

function getType(stat) {
    if (stat.isFile())
        return 'file';
    if (stat.isDirectory())
        return 'directory';
    return 'unknown';
}
