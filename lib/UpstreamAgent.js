const _ = require('lodash');
const uuid = require('uuid/v4');
const transformURL = require('./transform-url');
const urlUtil = require('url');

const DEFAULT_TTL = 10*1000;
class UpstreamAgent {
  constructor (args) {
    this.id = args.id;
    this.http = args.http;
    this.socket = args.socket;
    this.target_address = args.target_address;
    this.sioBuilder = args.socketio_builder;
    this.logger = args.logger;
    this.req_ttl = args.req_ttl || DEFAULT_TTL;
    this.requests = {};
    this.sioConnections = {};

    this.socket.on('broker_request', this.handleBrokerRequest.bind(this));

    if(this.sioBuilder) {
      this.socket.on('client_sio_connection', this.sioHandleClientConnection.bind(this));
      this.socket.on('client_sio_disconnection', this.sioHandleClientDisconnection.bind(this));
      this.socket.on('client_sio_message', this.sioHandleClientMessage.bind(this));
    }
    else this.socket.on('client_sio_connection', payload => {
      this.socket.emit('upstream_sio_disconnect', {connection: payload.connection});
    })
  }

  sioHandleClientConnection(payload) {
    var id = payload.connection;
    var conn = this.sioConnections[id] = {
      id: id,
      socket: this.sioBuilder()
    };

    this.logger.debug(`client_sio_connection for "${id}"`);
    conn.socket.on('disconnect', this.sioHandleDisconnect.bind(this, id));
    conn.socket.on('*', this.sioHandleMessage.bind(this, id));
  }
  sioHandleClientDisconnection(payload) {
    var id = payload.connection;
    var conn = this.sioConnections[id];
    if(!conn) return;
    this.sioRemoveConnection(id);

    this.logger.debug(`client_sio_disconnection for "${id}"`);
    conn.socket.disconnect();
  }
  sioHandleClientMessage(payload) {
    var id = payload.connection;
    var conn = this.sioConnections[id];
    if(!conn) return;

    this.logger.debug(`client_sio_message for "${id}"`);
    conn.socket.emit.apply(conn.socket, payload.message);
  }
  sioHandleMessage(id, ...msg) {
    this.logger.debug(`upstream_sio_message for "${id}"`);
    this.socket.emit('upstream_sio_message', {connection: id, message: msg});
  }
  sioHandleDisconnect(id) {
    var conn = this.sioConnections[id];
    if(!conn) return;
    this.sioRemoveConnection(id);

    this.logger.debug(`upstream_sio_disconnect for "${id}"`);
    this.socket.emit('upstream_sio_disconnect', {connection: id});
  }
  sioRemoveConnection(id) {
    delete this.sioConnections[id];
  }

  register() {
    this.socket.emit('register', 'upstream', this.id);
  }

  // broker_request (receives)
  handleBrokerRequest(payload) {
    this.logger.trace(payload);
    const id = uuid();
    // TODO: set ttl relative to broker ttl
    const ttl = Date.now() + this.req_ttl;
    this.logger.info(`sending request ${id} broker msg ${payload.broker_req_id} with ttl ${ttl}`);

    var request = payload;
    request.id = id;
    request.timeout = setTimeout(this.handleRequestTimeout.bind(this), this.req_ttl, id);
    this.requests[id] = request;

    try {
      this.logger.debug(this.target_address, payload.url)
      var url = urlUtil.resolve(this.target_address, payload.url);
    }
    catch(err) {
      return this.sendUpstreamError(request.id, err);
    }

    this.http(
      {
        method: request.method,
        // TODO: change url
        url: url,
        headers: request.headers,
        body: request.body
      },
      (err, res, body) => {
        if(err) return this.sendUpstreamError(request.id, err);
        this.sendUpstreamResponse(request.id, res, body);
      }
    );
  }

  // broker_request_ack (sends)
  sendBrokerRequestAck(id) {
    var request = this.requests[id];
    if(!request) return;
    this.logger.debug(`sending ${request.id} broker request ack`);
    this.socket.emit('broker_request_ack', {broker_req_id: request.broker_req_id, upstream_req_id: request.id});
  }

  // upstream_response (sends)
  sendUpstreamResponse(id, res, body) {
    var request = this.requests[id];
    if(!request) return;
    this.logger.debug(`sending ${request.id} upstream response`);
    this.removeRequest(id);

    this.socket.emit('upstream_response', {
      client_req_id: request.client_req_id,
      broker_req_id: request.broker_req_id,
      upstream_req_id: request.id,
      status_code: res.statusCode,
      headers: res.headers,
      body: body
    });
  }

  // upstream_error (sends)
  sendUpstreamError(id, err) {
    var request = this.requests[id];
    if(!request) return;
    this.logger.debug(`sending ${request.id} upstream error ${err.name}: ${err.message}`);
    this.removeRequest(id);

    this.socket.emit('upstream_error', {
      broker_req_id: request.broker_req_id,
      error: err
    });
  }

  handleRequestTimeout(id) {
    var request = this.requests[id];
    if(!request) return;
    this.logger.warn(`request ${id} timed out`);
    this.removeRequest(id);
  }

  removeRequest(id) {
    var request = this.requests[id];
    if(!request) return;
    clearTimeout(request.timeout);
    delete this.requests[id];
  }

}

module.exports = UpstreamAgent;
