const assert = require('assert');
const transformURL = require('../lib/transform-url');

module.exports = {
  'Transform Url Util': {
    'should replace origin part with target': function() {
      var target = 'http://example.com:1234';
      assert.equal(transformURL(target, 'http://otherserver.com:7893/a/b/c'), target+'/a/b/c');
      assert.equal(transformURL(target, 'http://otherserver.com/a/b/c'), target+'/a/b/c');
      assert.equal(transformURL(target, 'https://otherserver.com/a/b/c'), target+'/a/b/c');
    },
  }
}
