import {
    MongoClient
} from 'mongodb';
import Vinyl from 'vinyl';
import recursive from 'recursive-readdir';
import async from 'async';
import Path from 'path';
import fs from 'fs-extra';

import logger from '../logger.js';
import File from '../file.js';

export default class MetadataDatabase {
    constructor(options = {}, onReady) {
        options = Object.assign({
            host: 'localhost',
            port: 27017,
            namespace: 'monet-eyes'
        }, options);
        this.whenReady = new Promise(resolve => this.ready = resolve);
        this.connected = false;
        this.connection = {
            host: options.host,
            port: options.port,
            namespace: options.namespace,
            url: `mongodb://${options.host}:${options.port}/${options.namespace}`
        };
        this.init();
    }
    init(cb = () => {}) {
        let _self = this;
        MongoClient.connect(this.connection.url, function(err, db) {
            if (err) {
                logger.fatal('Could not connect to database:', err);
                return cb(err);
            }

            logger.info("Connected to mongodb server");
            _self.connection.link = db;
            _self.connected = true;

            // Connect to metadata collection
            _self.db = db.collection('metadata');

            // Index history subfield for faster access
            _self.db.createIndex({
                history: 1
            });
            _self.ready();
            cb();
        });
    }
    get = (path, cb, sync = true, projection = {}) => this.whenReady.then(() => {
        let _self = this;

        logger.trace('Database request for [%s]', path, '\nProjection:', projection, '\nAttempting to fulfill request...');

        // Remove trailing slash
        path = path.replace(/\/$/, "");

        this.db.findOne({
            "history.0": path
        }, Object.assign({
            history: {
                $slice: -1
            }
        }, projection), (err, doc) => {
            if (err) {
                logger.error('Could not get from database:', err);
                return cb(err);
            }

            if (!doc) {
                if (sync)
                    _self.sync(path, (err) => {
                        if (err) return cb(err);
                        _self.get(path, cb, false);
                    });
                else
                    cb(null, null);
                return;
            }

            let file = new File(doc, (err, updated) => {
                if (err)
                    return cb(err);

                cb(null, file);

                if (updated)
                    _self.store(file, (err) => {
                        if (err)
                            logger.error(err);
                    });
            });
        });
    });
    exists = (path, cb) => this.whenReady.then(() => {
        this.db.find({
            "history.0": path
        }, {
            history: {
                $slice: -1
            },
            _id: 1
        }).count(true, {
            limit: 1
        }, (err, count) => {
            if (err)
                return cb(err);

            cb(null, !!count);
        });
    });
    store = (vinyl, cb = () => {}) => this.whenReady.then(() => {
        if (!Vinyl.isVinyl(vinyl)) {
            return cb('Object passed is not vinyl.');
        }

        logger.trace('Inserting [%s] into database', vinyl.relative);
        this.get(vinyl.path, (err, doc) => {
            if (err) return cb(err);

            if (!doc)
                this.db.insertOne(vinyl, (err, result) => {
                    if (err)
                        return cb(err);

                    cb(null, result);
                });
            else {
                this.db.updateOne({
                    _id: doc._id
                }, vinyl, (err, result) => {
                    if (err)
                        return cb(err);

                    cb(null, result);
                });
            }
        }, false);
    });
    sync(dir, cb = () => {}) {
        let _self = this;

        logger.trace('Syncing %s...', dir);

        if (!fs.existsSync(dir))
            return cb(new Error('Path does not exist'));

        // TODO: change to check database before stat'ing
        File.stat(dir, (err, stats) => {
            if (err) return cb(err);

            if (stats.isFile()) {
                dir = Path.dirname(dir);
            } else if (!stats.isDirectory())
                return cb(`Avoiding ${dir} file that is not of type file or directory`);

            recursive(dir, (err, paths) => {
                if (err) {
                    logger.error('Could not traverse directory [%s]:', dir, err);
                    return cb('Error traversing directory: ' + (err.message || err));
                }

                // Sync this directory with database
                let queries = [(finished) => {
                    _self.exists(dir, (err, exists) => {
                        if (err) {
                            logger.error('Error retrieving file:', err);
                            return cb('Error retrieving file: ' + (err.message || err));
                        }
                        if (!exists) {
                            _self.registerFile(dir, finished);
                        } else {
                            finished();
                        }
                    }, false);
                }];

                // Sync all sub files/directories
                for (let path of paths) {
                    queries.push((finished) => {

                        // TODO: Update query to exists, not get
                        _self.exists(path, (err, exists) => {
                            if (err) {
                                logger.error('Error retrieving file:', err);
                                return finished('Error retrieving file: ' + (err.message || err));
                            }
                            if (!exists) {
                                _self.registerFile(path, finished);
                            } else {
                                finished();
                            }
                        }, false);
                    });
                }
                async.parallel(queries, (err, results) => {
                    logger.trace('Syncing %s... Done', dir);
                    cb(err, results);
                });
            });


        });
    }
    registerFile(path, cb = () => {}) {
        let _self = this;
        let file = new File({
            path
        }, (err) => {
            if (err) {
                logger.warn('Failed to register file [%s]:', path, err)
                return cb(err);
            }

            _self.store(file, cb);
        });
    }
    close(cb = () => {}) {
        logger.debug('Metadata database closed');
        if (this.connection && this.connection.link)
            this.connection.link.close(cb);
        else cb();
    }
}
