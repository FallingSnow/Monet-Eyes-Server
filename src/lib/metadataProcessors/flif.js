import {
    exec
} from 'child_process';
const sizeRegex = /\, ([0-9]+)x([0-9]+)\,/;
import logger from '../logger.js';

export default function metadata(file, cb) {
    let path = file.path;

    logger.trace('Identifying flif:', path);

    // TODO: can use own decoder to get width & height
    exec('flif --identify ' + path, function(err, stdout) {
        if (err)
            return cb(err);

        let matches = sizeRegex.exec(stdout);
        if (!matches)
            return cb(stdout);

        Object.assign(file.metadata, {
            dimensions: {
                width: matches[1],
                height: matches[2]
            }
        });

        cb(null);
    });
}
