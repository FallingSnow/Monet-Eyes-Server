const webpack = require('webpack');
const path = require('path');
const fs = require('fs-extra');
const os = require('os');
const packageJson = require('./package.json');

const ENV = process.env.NODE_ENV || 'development';

// Tell webpack how all node_modules can be loaded without
// including them in the bundle.js
let nodeModules = {};
fs.readdirSync('node_modules')
    .filter(function(x) {
        return ['.bin'].indexOf(x) === -1;
    })
    .forEach(function(mod) {
        nodeModules[mod] = 'commonjs ' + mod;
    });

let tempDir = path.join(os.tmpdir(), packageJson.name);
fs.ensureDirSync(tempDir);
let symLink = path.join(tempDir, 'node_modules');
if (ENV === 'development' && !fs.existsSync(symLink))
    fs.symlinkSync(path.resolve(__dirname, 'node_modules'), symLink, 'dir');

const config = {
    target: 'async-node',
    context: path.resolve(__dirname, "src"),
    entry: [
        // 'webpack/hot/signal',
        // 'webpack/hot/poll?500',
        './index.js'
    ],

    output: {
        path: ENV === 'production' ? path.resolve(__dirname, "build") : path.join(tempDir),
        publicPath: '',
        filename: 'bundle.js'
    },

    recordsPath: ENV === 'production' ? path.resolve(__dirname, "build/_records") : path.join(tempDir, '_records'),
    externals: ENV === 'development' ? nodeModules : [],

    resolve: {
        extensions: ['.js', '.json'],
        // unsafeCache: true
    },


    module: {
        rules: [{
            enforce: 'pre',
            test: /\.js$/,
            exclude: [/src\//],
            loader: 'source-map-loader'
        }, {
            test: /\.json$/,
            loader: 'json-loader'
        }, {
            test: /\.js$/,
            exclude: /node_modules/,
            loader: 'babel-loader'
        }, {
            test: /\.(flif)(\?v=[0-9]\.[0-9]\.[0-9])?$/,
            loader: "file-loader"
        }]
    },

    plugins: ([
            new webpack.DefinePlugin({
                'process.env': JSON.stringify({
                    NODE_ENV: ENV
                })
            }),
            new webpack.BannerPlugin({
                banner: 'require("source-map-support").install();',
                raw: true,
                entryOnly: false
            })
        ])
        .concat(ENV === 'production' ? [
            new webpack.optimize.DedupePlugin(),
            new webpack.optimize.UglifyJsPlugin()
        ] : [
            // new webpack.HotModuleReplacementPlugin({
            //     quiet: true
            // })
        ]),

    stats: {
        colors: true
    },

    devtool: 'cheap-module-source-map',
    // devtool: '#inline-source-map',
};

module.exports = config;
