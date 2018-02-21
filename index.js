const ConcatSource = require("webpack-sources").ConcatSource

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
  }

  apply(compiler) {
    const options = this.options
    compiler.plugin('compilation', (compilation) => {
      compilation.plugin('optimize-chunk-assets',  (chunks, done) => {
        const requires = getRequires(options, chunks)
        replaceBundleReadDir(compilation, chunks, requires)
        done()
      })
    })
  }
}

function replaceBundleReadDir(compilation, chunks, requires){
	chunks.forEach(function (chunk) {
		chunk.files.forEach(function (fileName) {
			replaceSource(compilation, fileName, requires)
		})
	})
}

function replaceSource(compilation, fileName, requires){
	let result = compilation.assets[fileName].source()
  const source = []
	requires.forEach((require) => {
    let buffer = []
    for (let c of result) {
      if (c !== '\n') {
        buffer.push(c)
      } else {
        const line = buffer.join('')
        const newLine = replaceFsReadDir (require, line)
        if (newLine !== undefined) {
          result = result.replace(line, newLine)
        }
        buffer = []
      }
    }
	})
	compilation.assets[fileName] = new ConcatSource(result)
}

function replaceFsReadDir (require, line) {
  const webpackRequire = '__webpack_require__'
  const fileName = require.path.replace(/^.*[\\\/]/, '')
  const fileStartMarker = line.indexOf(fileName)
  const readDirMarker = line.lastIndexOf('readFile')
  if (fileStartMarker !== -1 && readDirMarker !== -1) {
    let fileEndMarker = line.indexOf(')', fileStartMarker)
    let getEnd = line.slice(fileStartMarker, fileEndMarker + 1)
    fileEndMarker = (getEnd.length > fileName.length + 2) ? line.indexOf(',', fileStartMarker) : fileEndMarker
    const startSlice = line.indexOf('(', readDirMarker) + 1
    const newLine = `${line.slice(0, startSlice)}${webpackRequire}(${require.id})${line.slice(fileEndMarker)}`
    return newLine
  } else {
    return undefined
  }
}

module.exports = WebpackFileResolverPlugin