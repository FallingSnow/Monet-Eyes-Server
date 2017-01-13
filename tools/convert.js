#!/bin/env node

const path = require('path');
const exec = require('child_process').exec;
const fs = require('fs-extra');
const gm = require('gm');

const PackageConfig = require('../package.json');

const files = fs.walkSync(PackageConfig.rootDirectory)

for (let f of files) {
    let parsedPath = path.parse(f);

    if (parsedPath.ext !== '.jpg')
        continue;

    const filePath = path.join(parsedPath.dir, parsedPath.base);
    const pngPath = path.join(parsedPath.dir, parsedPath.name + '.png');
    const flifPath = path.join(parsedPath.dir, parsedPath.name + '.flif');

    gm(filePath)
        .write(pngPath, function(err) {
            if (err) {
                console.log(err);
                return;
            }

            exec('flif -e ' + pngPath + ' ' + flifPath, function(err, stdout, stderr) {
                console.log("Finished", filePath);
                fs.removeSync(pngPath);
            });
        });
}
