const assert = require('assert');
const UpstreamAgent = require('../lib/UpstreamAgent');
const EventEmitter = require('events');

const logger = {
  fatal: () => {},
  error: () => {},
  warn: () => {},
  info: () => {},
  debug: () => {},
  trace: () => {},
  // fatal: console.log,
  // error: console.log,
  // warn: console.log,
  // info: console.log,
  // debug: console.log,
  // trace: console.log,
  child: () => logger
};

module.exports = {
  'UpstreamAgent': {

    'should send "upstream_error" in event of an error': function(done) {
      var http = function(args, cb) {
        cb(new Error('fail'));
        return new EventEmitter();
      };
      var socket = new EventEmitter();
      var now = Date.now();

      var upstreamAgent = new UpstreamAgent({
        id: 'upstream',
        http: http,
        socket: socket,
        target_address: 'http://example.com:9000',
        logger: logger
      });

      socket.on('upstream_error', payload => {
        assert.equal(payload.broker_req_id, 'brokerblah');
        assert.equal(payload.error.message, 'fail');
        done()
      });

      socket.emit('broker_request', {
        client_id: 'test',
        client_req_id: 'clientblah',
        client_req_ttl: now+100,
        upstream_target: 'upstream',
        method: 'GET',
        headers: {},
        url: '/blah/deblah',
        body: '',
        broker_id: 'broker',
        broker_req_id: 'brokerblah'
      });
    },

    'should send "upstream_response" on HTTP response': function(done) {
      var http = function(args, cb) {
        assert.equal(args.url, 'http://example.com:9000/blah/deblah');
        cb(
          null,
          {statusCode: 200, headers: {'content-type': 'application/json'}},
          JSON.stringify({blah: 'deblah'})
        );
        return new EventEmitter();
      };
      var socket = new EventEmitter();
      var now = Date.now();

      var upstreamAgent = new UpstreamAgent({
        id: 'upstream',
        http: http,
        socket: socket,
        target_address: 'http://example.com:9000',
        logger: logger
      });

      socket.on('upstream_response', payload => {
        assert.equal(payload.client_req_id, 'clientblah');
        assert.equal(payload.broker_req_id, 'brokerblah');
        assert(payload.upstream_req_id);
        assert.equal(payload.status_code, 200);
        assert.deepEqual(payload.headers, { 'content-type': 'application/json' });
        assert.equal(payload.body, '{"blah":"deblah"}');
        done();
      });

      socket.emit('broker_request', {
        client_id: 'test',
        client_req_id: 'clientblah',
        client_req_ttl: now+100,
        upstream_target: 'upstream',
        method: 'GET',
        headers: {},
        url: '/blah/deblah',
        body: '',
        broker_id: 'broker',
        broker_req_id: 'brokerblah'
      });
    },

  }
}
