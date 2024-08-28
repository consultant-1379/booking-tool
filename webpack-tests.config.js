var path = require('path');
var fs = require('fs');

var nodeModules = {};
fs.readdirSync(path.resolve(__dirname, 'node_modules'))
  .filter(x => ['.bin'].indexOf(x) === -1)
  .forEach(mod => { nodeModules[mod] = `commonjs ${mod}`; });

nodeModules['selenium-webdriver'] = 'commonjs selenium-webdriver';
nodeModules['selenium-webdriver/testing'] = 'commonjs selenium-webdriver';

var rules = [
];
rules.push({
  enforce: 'pre',
  test: /\.js$/,
  exclude: /node_modules/,
  loader: 'eslint-loader'
});

module.exports = {
  entry: './lintTests.js',
  target: 'node',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'testing.js'
  },
  module: {
    rules: rules
  },
  node: {
    fs: 'empty'
  },
  watch: false,
  externals: nodeModules,
  mode: 'development'
};
