var path = require('path');
var fs = require('fs');

function isTest() {
  return process.env.NODE_ENV === 'test';
}
function isDevelopment() {
  return process.env.NODE_ENV === 'development';
}
function isProduction() {
  return process.env.NODE_ENV === 'production';
}

var rules = [
];
if (isTest()) {
  rules.push({
    enforce: 'pre',
    test: /\.js$/,
    exclude: /node_modules/,
    loader: 'eslint-loader'
  });
}

var nodeModules = {};
fs.readdirSync(path.resolve(__dirname, 'node_modules'))
  .filter(x => ['.bin'].indexOf(x) === -1)
  .forEach(mod => { nodeModules[mod] = `commonjs ${mod}`; });

module.exports = {
  entry: './server.js',
  target: 'node',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js'
  },
  module: {
    rules: rules
  },
  watch: isDevelopment(),
  externals: nodeModules,
  mode: isProduction() ? 'production' : 'development'
};
