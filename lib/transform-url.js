const urlUtil = require('url');

module.exports = function(target, url) {
  var parsed = new urlUtil.URL(url);
  return urlUtil.resolve(target, url.slice(parsed.origin.length));
}
