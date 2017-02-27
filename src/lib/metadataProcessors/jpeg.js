const gm = require('gm').subClass({
    imageMagick: true
});
import Datauri from 'datauri';
import Async from 'async';

import logger from '../logger.js';

const format = 'webp';

export default function metadata(file, cb) {
    let path = file.path;

    logger.trace('Identifying jpeg:', path);

    let converter = gm(path);

    Async.parallel([

        // Get extra data about jpeg
        // FIXME: leaks path in metadata
        (done) => converter.identify(function(err, data) {
            if (err) return done(err);
            Object.assign(file.metadata, data, {version: VERSION});
            done();
        }),

        // Generate smaller versions of image
        (done) => Async.parallel({
            // !x32
            thumbnail: (done) => converter
                .strip()
                .setFormat(format)
                .resize(null, 32)
                .quality(1)
                .toBuffer(function(err, buffer) {
                    if (err) return done(err);
                    done(null, new Datauri().format('.' + format, buffer).content);
                }),

            // !x180
            180: (done) => converter
                .strip()
                .setFormat(format)
                .resize(null, 180)
                .quality(70)
                .toBuffer(function(err, buffer) {
                    if (err) return done(err);
                    done(null, new Datauri().format('.' + format, buffer).content);
                })
        }, (err, results) => {
            if (err)
                return done(err);

            Object.assign(file.metadata, {
                scaled: results
            });
            done();
        })
    ], (err) => {
        if (err)
            return cb(err);

        cb();
    });
}
export const VERSION = 2;
