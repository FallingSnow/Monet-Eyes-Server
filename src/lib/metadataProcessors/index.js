import flif from './flif.js';
import jpeg from './jpeg.js';
import logger from '../logger.js';
import optional from 'optional';

export default function process(file, cb) {

    switch (getType(file.mime, file.extname)) {
        case 'flif':
            flif(file, cb);
            break;
        case 'jpeg':
            jpeg(file, cb);
            break;
        default:
            cb(null);
            break;
    }
}

function getType(mime, ext) {
    switch (mime) {
        case 'image/flif':
            return 'flif';
        case 'image/jpeg':
            return 'jpeg';
        default:
            logger.trace('Unknown mime type:', mime, '\tExtension:', ext);
            logger.trace('Using extension...');
            switch (ext) {
                case '.flif':
                    return 'flif';
                case '.jpeg':
                case '.jpg':
                    return 'jpeg';
                default:
                    logger.debug('Unknown file extension:', ext);
                    return null;
            }
    }
}

export function metadataIsOutdated(file) {
    const type = getType(file.mime, file.extname);
    if (type === null)
        return false;

    const moduleVersion = require('./'+type+'.js').VERSION;
    return ((file.metadata.version || 0) < (moduleVersion || 0));
}
