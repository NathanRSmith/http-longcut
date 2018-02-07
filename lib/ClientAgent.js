const _ = require('lodash');
const uuid = require('uuid/v4');

const DEFAULT_TTL = 10*1000;
class ClientAgent {
  constructor (args) {
    this.id = args.id;
    this.server = args.server;
    this.socket = args.socket;
    this.socketio_server = args.socketio_server;
    this.upstream_target = args.upstream_target;
    this.logger = args.logger;
    this.req_ttl = args.req_ttl || DEFAULT_TTL;
    this.requests = {};
    this.sioConnections = {};

    this.server.on('request', this.handleHTTPRequest.bind(this));
    this.socket.on('client_request_ack', this.handleClientRequestAck.bind(this));
    this.socket.on('broker_response', this.handleBrokerResponse.bind(this));
    this.socket.on('broker_error', this.handleBrokerError.bind(this));
    this.socket.on('upstream_sio_disconnect', this.sioHandleUpstreamDisconnect.bind(this));
    this.socket.on('upstream_sio_message', this.sioHandleUpstreamMessage.bind(this));

    if(this.socketio_server) {
      this.socketio_server.on('connection', this.sioHandleConnection.bind(this));
    }
  }

  sioHandleConnection(socket) {
    var id = uuid();
    this.sioConnections[id] = {
      id: id,
      socket: socket
    };

    this.logger.debug(`sending client_sio_connection for "${id}" to "${this.upstream_target}"`);
    this.socket.emit('client_sio_connection', {upstream: this.upstream_target, connection: id});
    socket.on('disconnect', this.sioHandleDisconnect.bind(this, id));
    socket.on('*', this.sioHandleMessage.bind(this, id));
  }
  sioHandleMessage(id, ...msg) {
    this.logger.debug(`client_sio_message for "${id}"`);
    this.socket.emit('client_sio_message', {connection: id, message: msg});
  }
  sioHandleDisconnect(id) {
    var conn = this.sioConnections[id];
    if(!conn) return;
    this.sioRemoveConnection(id);

    this.logger.debug(`client_sio_disconnection for "${id}"`);
    this.socket.emit('client_sio_disconnection', {connection: id});
  }
  sioHandleUpstreamDisconnect(payload) {
    var conn = this.sioConnections[payload.connection];
    if(!conn) return;
    this.sioRemoveConnection(conn.id);

    this.logger.debug(`upstream_sio_disconnect for "${conn.id}"`);
    conn.socket.disconnect(true);
  }
  sioHandleUpstreamMessage(payload) {
    var conn = this.sioConnections[payload.connection];
    if(!conn) return;

    this.logger.debug(`upstream_sio_message for "${conn.id}"`);
    conn.socket.emit.apply(conn.socket, payload.message);
  }
  sioRemoveConnection(id) {
    delete this.sioConnections[id];
  }


  register() {
    this.socket.emit('register', 'client', this.id);
  }

  handleHTTPRequest(req, res) {
    this.logger.info('incoming request '+req.method+' '+req.url);

    // buffer body
    var body = '';
    // TODO: enforce body size limit
    // NOTE: assumes text
    req.on('data', data => body+=data);
    // send request to broker
    req.on('end', () => this.sendClientRequest(req, res, body));
  }

  // client_request (sends): Initiates request to be proxied
  // payload: request object with client fields, upstream_name, headers & body
  sendClientRequest(req, res, body) {
    const id = uuid();
    const ttl = Date.now() + this.req_ttl;

    this.logger.info(`sending request ${id} with ttl ${ttl}`);
    this.requests[id] = {
      id: id,
      http_req: req,
      http_res: res,
      http_body: body,
      ttl: ttl,
      timeout: setTimeout(this.handleRequestTimeout.bind(this), this.req_ttl, id),
      logger: this.logger.child({client_req_id: id})
    };

    this.socket.emit('client_request', {
      client_id: this.id,
      client_req_id: id,
      client_req_ttl: ttl,
      upstream_target: this.upstream_target,
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: body
    });
  }

  // client_request_ack (receives): Indicates a request was received by the broker
  // payload: client_req_id & broker_req_id
  handleClientRequestAck(payload) {
    this.logger.trace(payload)
    this.logger.debug(`request ${payload.client_req_id} ack received ${payload.broker_req_id}`);
  }

  // broker_response (receives): Response from upstream agent
  // payload: response object
  handleBrokerResponse(payload) {
    this.logger.trace(payload)
    var request = this.requests[payload.client_req_id];
    if(!request) return;
    this.logger.warn(`request ${request.id} response received`);
    this.removeRequest(request.id);

    request.http_res.statusCode = payload.status_code || 200;
    _.each(payload.headers, (v, k) => request.http_res.setHeader(k, v));
    request.http_res.end(payload.body);
  }

  // broker_error (receives): Indicates an error occurred while broker or upstream handling a request
  // payload: client_req_id & error object
  handleBrokerError(payload) {
    this.logger.trace(payload)
    var request = this.requests[payload.client_req_id];
    if(!request) return;
    this.removeRequest(request.id);
    this.logger.warn(`request ${request.id} broker error received ${payload.error.name}: ${payload.error.message}`);

    request.http_res.statusCode = 500;
    request.http_res.end();
  }

  handleRequestTimeout(id) {
    var request = this.requests[id];
    if(!request) return;
    this.logger.warn(`request ${id} timed out`);
    this.removeRequest(id);

    request.http_res.statusCode = 504;
    request.http_res.end();
  }

  removeRequest(id) {
    var request = this.requests[id];
    if(!request) return;
    clearTimeout(request.timeout);
    delete this.requests[id];
  }
}

module.exports = ClientAgent;
