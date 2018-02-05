const assert = require('assert');
const ClientAgent = require('../lib/ClientAgent');
const EventEmitter = require('events');
const MockReq = require('mock-req');
const MockRes = require('mock-res');

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
  'ClientAgent': {

    'should send "client_request" via socket on receiving an HTTP request': function(done) {
      var server = new EventEmitter();
      var socket = new EventEmitter();

      socket.on('client_request', payload => {
        assert.equal(payload.client_id, 'test')
        assert(payload.client_req_id)
        assert(payload.client_req_ttl >= Date.now())
        assert.equal(payload.upstream_target, 'upstream');
        assert.equal(payload.method, 'POST');
        assert.equal(payload.url, 'blah/de/blah');
        assert.deepEqual(payload.headers, {});
        assert.equal(payload.body, 'hi');

        clientAgent.removeRequest(payload.client_req_id);
        done();
      })

      var clientAgent = new ClientAgent({
        id: 'test',
        server: server,
        socket: socket,
        upstream_target: 'upstream',
        logger: logger
      });

      var req = new MockReq({
        method: 'POST',
        url: 'blah/de/blah',
        headers: {}
      });
      var res = new MockRes();

      server.emit('request', req, res);
      req.write('hi');
      req.end();
    },

    'should reply 504 if req ttl reached': function(done) {
      var server = new EventEmitter();
      var socket = new EventEmitter();
      var now = Date.now();

      socket.on('client_request', payload => {});

      var clientAgent = new ClientAgent({
        id: 'test',
        server: server,
        socket: socket,
        upstream_target: 'upstream',
        logger: logger,
        req_ttl: 10
      });

      var req = new MockReq({
        method: 'GET',
        url: 'blah/de/blah',
        headers: {}
      });
      var res = new MockRes();

      server.emit('request', req, res);
      res.on('finish', () => {
        assert.equal(res.statusCode, 504);
        done();
      });
    },

    'should reply with error if "broker_error" received for pending request': function(done) {
      var server = new EventEmitter();
      var socket = new EventEmitter();
      var now = Date.now();

      socket.on('client_request', payload => {
        socket.emit('broker_error', {
          client_req_id: payload.client_req_id,
          error: new Error('fail')
        });
      });

      var clientAgent = new ClientAgent({
        id: 'test',
        server: server,
        socket: socket,
        upstream_target: 'upstream',
        logger: logger,
        req_ttl: 10
      });

      var req = new MockReq({
        method: 'GET',
        url: 'blah/de/blah',
        headers: {}
      });
      var res = new MockRes();

      server.emit('request', req, res);
      res.on('finish', () => {
        assert.equal(res.statusCode, 500);
        done();
      });
    },

    'should reply with response on "broker_response"': function(done) {
      var server = new EventEmitter();
      var socket = new EventEmitter();
      var now = Date.now();

      socket.on('client_request', payload => {
        socket.emit('broker_response', {
          client_req_id: payload.client_req_id,
          broker_req_id: 'blah',
          upstream_req_id: 'deblah',
          statusCode: 200,
          headers: {'content-type': 'application/json'},
          body: JSON.stringify({blah: 'deblah'})
        });
      });

      var clientAgent = new ClientAgent({
        id: 'test',
        server: server,
        socket: socket,
        upstream_target: 'upstream',
        logger: logger,
        req_ttl: 10
      });

      var req = new MockReq({
        method: 'GET',
        url: 'blah/de/blah',
        headers: {}
      });
      var res = new MockRes();

      server.emit('request', req, res);
      res.on('finish', () => {
        assert.equal(res.statusCode, 200);
        assert.deepEqual(res.getHeaders(), {'content-type': 'application/json'});
        assert.deepEqual(res._getJSON(), {blah:'deblah'});
        done();
      });
    },

  }
}
