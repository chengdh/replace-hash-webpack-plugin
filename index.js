/**
 *
 * 更多文件匹配规则
 * @see https://github.com/isaacs/node-glob
 */
'use strict';

var path = require('path');
var fs = require('fs');
var util = require('util');
var url = require('url');
var mkdirp = require('mkdirp');
var endsWith = require('lodash.endswith');
var packingGlob = require('packing-glob');

var defaultPatternList = [
  {
    find: '%s\\.(\\w{8})?',
    replace: '%s.'
  }
];

function ReplaceHashPlugin(options) {
  this.options = options || {};
  if (!this.options.exts) {
    this.options.exts = ['.js', '.css'];
  }
  if (!this.options.cssChunkFileName) {
    this.options.cssChunkFileName = "assets/stylesheets/[name][contenthash:8].css";
  }
}

ReplaceHashPlugin.prototype.apply = function (compiler) {
  var self = this;
  self.options.cwd = self.options.cwd ? (path.isAbsolute(self.options.cwd) ? self.options.cwd : path.resolve(compiler.options.context, self.options.cwd)) : compiler.options.context;
  self.options.dest = path.isAbsolute(self.options.dest) ? self.options.dest : path.resolve(process.cwd(), self.options.dest);

  compiler.plugin('done', function (stats) {
    var publicPath = compiler.options.output.publicPath;
    var jsChunkFileName = compiler.options.output.filename;
    var cssChunkFileName = self.options.cssChunkFileName

    var patterns = self.options.src;
    packingGlob(patterns, self.options).forEach(function (file) {
      var fullpath = path.join(self.options.cwd, file);
      var data = fs.readFileSync(fullpath, 'utf8');

      Object.keys(stats.compilation.assets).filter(function (item) {
        return self.options.exts.some(function (e) {
          return endsWith(item, e);
        });
      }).forEach(function (item) {
        var ext = path.extname(item); //.js
        var name = path.basename(item, ext); //main-e1bb26
        var filename;

        switch (ext) {
          case '.js':
            filename = jsChunkFileName;
            break;
          case '.css':
            filename = cssChunkFileName;
            break;
          default:
            compiler.options.module.rules.forEach(function (rule) {
              if (rule.test.test(ext) || rule.test.toString().indexOf(ext) > -1) {
                var query = rule.query || rule.options;
                if (rule.use) {
                  rule.use.forEach(function (use) {
                    if (use.loader === 'url' ||
                      use.loader === 'url-loader' ||
                      use.loader === 'file' ||
                      use.loader === 'file-loader') {
                      query = use.query || use.options;
                    }
                  })
                }
                if (query) {
                  filename = query.name;
                } else {
                  filename = '[hash].[ext]';
                }
              }
            })
        }
        var hashLengthMatches = filename.match(/\[\S*hash:(\d+)\]/i);
        var hashLength;
        if (hashLengthMatches) {
          if (hashLengthMatches[1]) {
            hashLength = hashLengthMatches[1];
          }
          var regString = filename
            .replace('\[path\]', '')
            .replace('\[name\]', '(\\S+)')
            .replace('\[ext\]', ext.substr(1, ext.length))
            .replace('\[chunkhash:' + hashLength + '\]', '(\\w{' + hashLength + '})')
            .replace('\[contenthash:' + hashLength + '\]', '(\\w{' + hashLength + '})')
            .replace('\[hash:' + hashLength + '\]', '(\\w{' + hashLength + '})');
          var matches = item.match(new RegExp(regString));
          if (matches) {
            var oldFilename = matches[1];
            var hash = matches[2]
            var oldPath = oldFilename;
            var newPath = `${oldFilename}.${hash}`;

            console.log("fullPath:", fullpath)
            console.log("oldPath:", oldPath)
            console.log("newPath:", newPath)

            //排除文件名类似:1.js,1.12345678.js的文件
            if (oldPath.length > 3) {
              data = self.doReplace(oldPath, newPath, data);
            }

          } else {
            console.log('[warnings]%s replace hash failed.', item);
          }
        } else {
          console.log('[warnings]matching filename failed. filename: %s', filename);
        }
      });

      var dest = path.resolve(self.options.dest, file);
      var destDir = path.dirname(dest);
      if (!fs.existsSync(destDir)) {
        mkdirp.sync(destDir);
      }
      fs.writeFileSync(dest, data);
      console.log('%s created.', dest);

    });
  });

};

ReplaceHashPlugin.prototype.doReplace = function (oldPath, newPath, data) {
  (this.options.pattern || defaultPatternList).forEach(function (pattern) {
    var search = util.format(pattern.find, oldPath);
    var replacement = util.format(pattern.replace, newPath);
    var regexp = new RegExp(search, 'gm');
    if (newPath.includes('fb5b206d')) {
      console.log("search:", search)
      console.log("replacement:", replacement)
      console.log("regexp:", regexp)
      var matches = data.match(regexp)
      console.log("matches:", matches)
    }
    data = data.replace(regexp, replacement);
  });
  return data;
}

module.exports = ReplaceHashPlugin;