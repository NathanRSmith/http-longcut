const assert = require('assert');
const Broker = require('../lib/Broker');
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
  'Broker': {

    'should round trip a request': function(done) {
      var socket = new EventEmitter();
      var client = new EventEmitter();
      var upstream = new EventEmitter();
      var now = Date.now();

      var broker = new Broker({
        id: 'broker',
        socket: socket,
        logger: logger
      });

      socket.emit('connection', client);
      client.emit('register', 'client', 'client123');
      socket.emit('connection', upstream);
      upstream.emit('register', 'upstream', 'upstream123');

      upstream.on('broker_request', payload => {
        upstream.emit('upstream_response', {
          client_req_id: payload.client_req_id,
          broker_req_id: payload.broker_req_id,
          upstream_req_id: 'ureq123',
          status_code: 200,
          headers: {'content-type': 'application/json'},
          body: '{"blah":"deblah"}'
        });
      });

      client.on('broker_response', payload => {
        assert.equal(payload.client_req_id, 'creq123');
        assert(payload.broker_req_id);
        assert.equal(payload.upstream_req_id, 'ureq123');
        assert.equal(payload.status_code, 200);
        assert.deepEqual(payload.headers, { 'content-type': 'application/json' });
        assert.equal(payload.body, '{"blah":"deblah"}');

        done();
      });

      client.emit('client_request', {
        client_id: 'client123',
        client_req_id: 'creq123',
        client_req_ttl: now+100,
        upstream_target: 'upstream123',
        method: 'POST',
        url: 'http://example.com/a/b/c',
        headers: {},
        body: 'hi'
      });

    },

    'should send "broker_error" on receiving "upstream_error"': function(done) {
      var socket = new EventEmitter();
      var client = new EventEmitter();
      var upstream = new EventEmitter();
      var now = Date.now();

      var broker = new Broker({
        id: 'broker',
        socket: socket,
        logger: logger
      });

      socket.emit('connection', client);
      client.emit('register', 'client', 'client123');
      socket.emit('connection', upstream);
      upstream.emit('register', 'upstream', 'upstream123');

      upstream.on('broker_request', payload => {
        upstream.emit('upstream_error', {
          broker_req_id: payload.broker_req_id,
          error: new Error('fail')
        });
      });

      client.on('broker_error', payload => {
        assert.equal(payload.client_req_id, 'creq123');
        assert.equal(payload.error.message, 'fail');

        done();
      });

      client.emit('client_request', {
        client_id: 'client123',
        client_req_id: 'creq123',
        client_req_ttl: now+100,
        upstream_target: 'upstream123',
        method: 'POST',
        url: 'http://example.com/a/b/c',
        headers: {},
        body: 'hi'
      });

    },

    'should send "broker_error" if unknown upstream': function(done) {
      var socket = new EventEmitter();
      var client = new EventEmitter();
      var upstream = new EventEmitter();
      var now = Date.now();

      var broker = new Broker({
        id: 'broker',
        socket: socket,
        logger: logger
      });

      socket.emit('connection', client);
      client.emit('register', 'client', 'client123');
      // socket.emit('connection', upstream);
      // upstream.emit('register', 'upstream', 'upstream123');

      client.on('broker_error', payload => {
        assert.equal(payload.client_req_id, 'creq123');
        assert.equal(payload.error.message, 'Upstream target "upstream123" not found');

        done();
      });

      client.emit('client_request', {
        client_id: 'client123',
        client_req_id: 'creq123',
        client_req_ttl: now+100,
        upstream_target: 'upstream123',
        method: 'POST',
        url: 'http://example.com/a/b/c',
        headers: {},
        body: 'hi'
      });
    }

  }
}
