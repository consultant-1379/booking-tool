var path = require('path');
var BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
var TerserPlugin = require("terser-webpack-plugin");
var ExtractTextPlugin = require('extract-text-webpack-plugin');

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
  {
    parser: {
      // Workaround to prevent issue of lodash leaking to be available globally
      // This can mean during development all might look fine, but in production due to minifiers
      // pages can then show issues if they hadn't explicitly imported lodash
      // https://github.com/webpack/webpack/issues/3017
      amd: false
    }
  },
  {
    test: /\.css$/,
    use: ExtractTextPlugin.extract({
      use: [
        {
          loader: 'css-loader',
          options: {
            minimize: isProduction()
          }
        }
      ]
    })
  },
  {
    test: /\.html$/,
    loader: 'html-loader'
  },
  {
    test: /\.(png|eot|svg|ttf|woff|woff2)$/,
    loader: 'file-loader'
  },
  {
    test: /favicon.ico$/,
    loader: 'file-loader',
    options: {
      name: '[name].[ext]'
    }
  }
];
var plugins = [
  new ExtractTextPlugin('style.css')
];

if (isTest()) {
  rules.push(
    {
      enforce: 'pre',
      test: /\.js$/,
      exclude: /node_modules/,
      loader: 'eslint-loader'
    },
    {
      enforce: 'pre',
      test: /\.css$/,
      exclude: [
        /node_modules/, /assets.css/, /bootstrap.css/,
        /systemBar.css/, /bootstrap-datetimepicker.css/,
        /fullcalendar.css/, /qtip2.css/
      ],
      loader: 'csslint-loader'
    },
    {
      enforce: 'pre',
      test: /\.html$/,
      exclude: /node_modules/,
      loader: 'htmlhint-loader',
      options: {
        failOnError: true,
        failOnWarning: true
      }
    }
  );
}

if (isProduction()) {
  rules.push({
    test: /\.js$/,
    exclude: /node_modules/,
    loader: 'babel-loader',
    options: {
      plugins: ['lodash']
    }
  });
}

if (isDevelopment()) {
  plugins.push(new BundleAnalyzerPlugin({
    analyzerHost: '0.0.0.0',
    analyzerPort: 8888
  }));
}

function prodOptimization() {
  return {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          output: {
            comments: false,
          },
        },
        extractComments: false,
      }),
    ],
  }
}

module.exports = {
  entry: './client.js',
  output: {
    path: path.resolve(__dirname, 'public'),
    publicPath: '/',
    filename: 'bundle.js'
  },
  module: {
    rules: rules
  },
  plugins: plugins,
  node: {
    // Workaround for https://github.com/webpack-contrib/css-loader/issues/447
    fs: 'empty'
  },
  optimization: isProduction() ? prodOptimization() : {},
  watch: isDevelopment(),
  devtool: isTest() ? false : 'source-map',
  mode: isProduction() ? 'production' : 'development'
};
