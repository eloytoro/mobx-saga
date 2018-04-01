module.exports = {
  entry: './src/index.js',
  output: {
    library: 'MobXSaga'
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        use: 'babel-loader'
      }
    ]
  }
}
