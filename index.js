const ConcatSource = require("webpack-sources").ConcatSource

const noRestForTheWicked = `
const __callsites__ = () => {
	const _ = Error.prepareStackTrace;
	Error.prepareStackTrace = (_, stack) => stack;
	const stack = new Error().stack.slice(1);
	Error.prepareStackTrace = _;
	return stack;
}
const __current_file__ = () => {
  const sep = require('path').sep
  let filePieces = __callsites__()[0].getFileName().split(sep)
  return filePieces.slice(0, -1).join(sep) + sep
};
`

function getRequires (options, chunks) {
  return chunks.reduce((c, chunk) => {
    chunk.forEachModule((module) => {
      const deps = module && module.fileDependencies && module.fileDependencies || []
      deps.forEach((filepath) => {
        if(options.test.test(filepath)) {
          c.add({
            path: filepath,
            id: module.id
          })
        }
      })
    })
    return c
  }, new Set())
}

class WebpackFileResolverPlugin {
  constructor(options = {}) {
    this.options = options
    if (this.options.test === undefined) {
      throw (new Error('No pattern defined'))
    }
    if (!this.options.hasOwnProperty('forceResolveExecutingFile')) {
      this.options.forceResolveExecutingFile = undefined
    }
  }

  apply(compiler) {
    const options = this.options
    compiler.plugin('compilation', (compilation) => {
      compilation.plugin('optimize-chunk-assets',  (chunks, done) => {
        const requires = getRequires(options, chunks)
        replaceBundleReadDir(compilation, chunks, requires, options)
        done()
      })
    })
  }
}

function replaceBundleReadDir(compilation, chunks, requires, options){
	chunks.forEach(function (chunk) {
		chunk.files.forEach(function (fileName) {
			replaceSource(compilation, fileName, requires, options)
		})
	})
}

function replaceSource(compilation, fileName, requires, options){
	let result = compilation.assets[fileName].source()
  if (options.forceResolveExecutingFile !== undefined) {
    result = noRestForTheWicked + result
  }
	requires.forEach((require) => {
    let buffer = []
    for (let c of result) {
      if (c !== '\n') {
        buffer.push(c)
      } else {
        const line = buffer.join('')
        const newLine = replaceFsReadDir (require, line, options)
        if (newLine !== undefined) {
          result = result.replace(line, newLine)
        }
        buffer = []
      }
    }
	})
	compilation.assets[fileName] = new ConcatSource(result)
}

function replaceFsReadDir (require, line, options) {
  const webpackRequire = '__webpack_require__'
  const fileName = require.path.replace(/^.*[\\\/]/, '')
  const fileStartMarker = line.indexOf(fileName)
  const readDirMarker = line.lastIndexOf('readFile')
  if (fileStartMarker !== -1 && readDirMarker !== -1) {
    let fileEndMarker = line.indexOf(')', fileStartMarker)
    let getEnd = line.slice(fileStartMarker, fileEndMarker + 1)
    fileEndMarker = (getEnd.length > fileName.length + 2) ? line.indexOf(',', fileStartMarker) : fileEndMarker
    const startSlice = line.indexOf('(', readDirMarker) + 1
    let importStr = `${webpackRequire}(${require.id})`
    if (options.forceResolveExecutingFile !== undefined) {
      // Server Land, brace for impact
      importStr = `__current_file__() + ${importStr}`
    }
    const newLine = `${line.slice(0, startSlice)}${importStr}${line.slice(fileEndMarker)}`
    return newLine
  } else {
    return undefined
  }
}

module.exports = WebpackFileResolverPlugin
