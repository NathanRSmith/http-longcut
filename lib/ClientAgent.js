const _ = require('lodash');
const uuid = require('uuid/v4');

const DEFAULT_TTL = 10*1000;
class ClientAgent {
  constructor (args) {
    this.id = args.id;
    this.server = args.server;
    this.socket = args.socket;
    this.upstream_target = args.upstream_target;
    this.logger = args.logger;
    this.req_ttl = args.req_ttl || DEFAULT_TTL;
    this.requests = {};

    this.server.on('request', this.handleHTTPRequest.bind(this));
    this.socket.on('client_request_ack', this.handleClientRequestAck.bind(this));
    this.socket.on('broker_response', this.handleBrokerResponse.bind(this));
    this.socket.on('broker_error', this.handleBrokerError.bind(this));
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
