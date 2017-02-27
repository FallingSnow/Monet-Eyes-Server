import fs from 'fs-extra';
import Path from 'path';
import PackageConfig from '../../package.json';
import Vinyl from 'vinyl';
import mime from 'mime';
import murmur from 'murmurhash-native';
import parallel from 'async/parallel';
import _ from 'lodash';
import metadataProcessor, {metadataIsOutdated} from './metadataProcessors';
import logger from './logger.js';

const VERSION = 2;
let isUpdating = {};
let counter = 0;

export default class File extends Vinyl {
    /*
     * @param mime = mime type
     * @param stats = stats object
     * @param type = file type (directory, file, other)
     * @param ready(updated)
     */
    constructor(options, onReady) {
        if (counter++ > 50)
        process.exit(1);
        if (Vinyl.isVinyl(options)) {
            super({
                path: options.history[options.history.length - 1]
            });
            Object.assign(this, options);

            // Update file if version is less than current
            if (this.version < File.version) {
                logger.debug('[%s]: Supplied file version [%d] less than that of database [%d]. Requesting file update...', this.relative, this.version, File.version);
                this.update(onReady);
            } else
                this.verifyIntegrity((valid) => {
                    if (!valid) {
                        logger.debug('[%s]: Supplied hash does not match current hash. Requesting file update...', this.relative);
                        this.update(onReady);
                    } else if (metadataIsOutdated(this)) {
                        logger.debug('[%s]: Metadata version is less than module\'s metadata version. Updating metadata...', this.relative);
                        this.update(onReady);
                    } else {
                        onReady();
                    }
                });
        } else {
            super(options);
            this.init(onReady);
            this.metadata = {};
        }

    }
    init(cb) {
        this.update(cb);
    }
    // cb(error, file, updated)
    update(cb = () => {}) {
        let _self = this;

        // If not already updating, start updating
        if (!isUpdating[this.path]) {
            isUpdating[this.path] = new Promise((resolve, reject) => {
                logger.trace('Updating %s', _self.path);

                // Update stats, filetype, and mime
                File.stat(_self.path, (err, stats) => {
                    if (err)
                        return reject(err);

                    _self.stat = stats;
                    if (stats.isFile()) {
                        _self.type = 'file';
                        _self.mime = mime.lookup(_self.path);
                    } else if (stats.isDirectory())
                        _self.type = 'directory';
                    else {
                        _self.type = 'other';
                    }

                    parallel([
                        // Update metadata
                        (done) => {
                            _self.special.call(_self, done);
                        },

                        // Update hash
                        (done) => {
                            _self.renderHash((hash) => {
                                _self.hash = hash;
                                done();
                            });
                        }
                    ], (err) => {
                        if (err) return reject(err);

                        _self.version = File.version;
                        resolve();
                    });
                });
            });
        }

        isUpdating[this.path].then(() => {
            delete isUpdating[this.path];
            cb(null, true);
        }).catch((err) => {
            logger.error('Error creating file:', err);
            delete isUpdating[this.path];
            cb('Error creating file: ' + err.message);
        })
    }
    verifyIntegrity(cb) {
        let _self = this;
        this.renderHash((hash) => {
            cb(_self.hash === hash);
        });
    }
    openStream(cb, options) {
        options = Object.assign({
            start: 0
        }, options);
        if (this.type === 'directory') {
            return cb(new Error('Cannot request readStream on a directory'))
        }
        switch (this.content.type) {
            case 'localfile':
                cb(null, fs.createReadStream(this.path, options));
                break;
            default:
                cb(new Error('Unknown content file type.'));
                break;
        }
    }

    // ################# This function applies file type specific operations
    special(cb) {
        let _self = this;
        if (this.type === 'directory') {
            fs.readdir(this.path, (err, children) => {
                _self.content = {
                    type: 'list',
                    list: children
                };
                cb();
            });
        } else if (this.type === 'file') {
            _self.content = {
                type: 'localfile',
                address: _self.path
            };
            metadataProcessor(this, cb);
        } else {
            cb();
        }
    }
    renderHash(cb) {
        if (this.type === 'file')
            fs.readFile(this.path, (err, data) => {
                if (err) throw err;
                cb(murmur.murmurHash128x64(data));
            });
        else if (this.type === 'directory') {
            // TODO: This is kind of retarded (reading a dir to see if I should
            // read it...)
            fs.readdir(this.path, (err, paths) => {
                cb(murmur.murmurHash128x64(paths.join('')));
            });
        } else {
            cb(Math.random());
        }
    }
    get sanitized() {
        let file = _.omitBy(this, (val, key) => {
            return key.startsWith('_');
        });
        return file;
    }
    static stat(path, cb) {
        fs.stat(path, (err, stats) => {
            if (err) {
                logger.error('Could not stat directory:', err);
                return cb(err);
            }
            cb(null, stats);
        });
    }
    static get version() {
        return VERSION;
    }
}


let FILE = {
    info: function(path, cb) {
        if (typeof cb !== 'function')
            return logger.log('Callback function was not provided.');
        if (typeof path !== 'string')
            return cb('First argument [path] must be of type string.');

        let file = {};
        const filePath = Path.join(PackageConfig.rootDirectory, path);
        Object.assign(file, getFilePaths(path));
        logger.log('Getting info for', filePath);
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
                    });
                });
            } else {
                FILE.getPathRealtiveTo(path, [-1, 1], function(err, paths) {
                    if (err)
                        return cb(err);

                    Object.assign(file, {
                        prev: paths[0],
                        next: paths[1],
                    });
                    cb(err, file);
                });
            }
        });
    },
    // TODO: Allow pos to be array of positions
    getPathRealtiveTo: function(path, positions, cb) {
        if (typeof cb !== 'function')
            return logger.log('Callback function was not provided.');
        if (typeof path !== 'string')
            return cb('First argument [path] must be of type string.');
        if (typeof positions !== 'object')
            return cb('Second argument [positions] must be of type object(array).');

        const filePath = Path.join(PackageConfig.rootDirectory, path);
        const directory = Path.dirname(filePath);
        logger.log('Getting path(s) at', positions, 'relative to', filePath);

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
