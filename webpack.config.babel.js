import webpack from 'webpack';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';
import packageJson from './package.json';

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
else {

}

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
        extensions: ['', '.js', '.json'],
        modulesDirectories: [
            path.resolve(__dirname, "node_modules"),
            'node_modules'
        ],
        // unsafeCache: true
    },


    module: {
        preLoaders: [{
            test: /\.js$/,
            exclude: [/src\//],
            loader: 'source-map'
        }],
        loaders: [{
            test: /\.json$/,
            loader: 'json-loader'
        }, {
            test: /\.js$/,
            exclude: /node_modules/,
            loader: 'babel'
        }, {
            test: /\.(ttf|eot|svg|flif)(\?v=[0-9]\.[0-9]\.[0-9])?$/,
            loader: "file-loader"
        }]
    },

    plugins: ([
            new webpack.NoErrorsPlugin(),
            new webpack.DefinePlugin({
                'process.env': JSON.stringify({
                    NODE_ENV: ENV
                })
            })
        ])
        .concat(ENV === 'production' ? [
            new webpack.optimize.OccurenceOrderPlugin(),
            new webpack.optimize.DedupePlugin(),
            new webpack.optimize.UglifyJsPlugin(),
            new webpack.BannerPlugin('require("source-map-support").install();', {
                raw: false,
                entryOnly: false
            })
        ] : [
            // new webpack.HotModuleReplacementPlugin({
            //     quiet: true
            // })
        ]),

    stats: {
        colors: true
    },

    devtool: 'source-map',
    // devtool: '#inline-source-map',
};

module.exports = config;
