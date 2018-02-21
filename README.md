# webpack-file-resolver#
=== To be used with `file-loader`, sometimes some dependencies use `readDirSync` or `readDir` to load these 
dependencies. This replaces things like `readDirSync(__dirname + './someDep.someExt', 'base64')` with 
`readDirSync(__webpack_require__(##), 'base64')` where `##` is the ID used by webpack. ---
#  Example Usage
```js var WebpackFileResolver = require('webpack-file-resolver') // The File Loader handles the file 
config.module.rules.push({
  test: /\.(someExt)$/,
  loader: "file-loader",
  options: {
    name: "deploy/[name].[ext]",
  },
})
// WebpackFileResolver will handle any bothering dependency with // webpack's reliable matching 
plugins.push(new WebpackFileResolver({
  test: /\.(someExt)$/,
}))
module.exports = config ```
