const _ = require('lodash');
const uuid = require('uuid/v4');

const DEFAULT_TTL = 10*1000;
class Broker {
  constructor (args) {
    this.id = args.id;
    this.socket = args.socket;
    this.logger = args.logger;
    this.req_ttl = args.req_ttl || DEFAULT_TTL;
    this.requests = {};
    this.clients = {};
    this.upstreams = {};

    this.socket.on('connection', sock => {
      sock.on('register', (type, id) => {
        if(type === 'client') this.registerClient(sock, id);
        else if(type === 'upstream') this.registerUpstream(sock, id);
        else sock.disconnect(true);
      });
    });
  }

  // register socket and set event handlers
  registerClient(sock, id) {
    this.clients[id] = sock;
    this.logger.info(`client "${id}" registered`);
    sock
      .on('disconnect', () => { delete this.clients[id]; })
      .on('client_request', payload => this.handleClientRequest(id, payload));
  }

  // register socket and set event handlers
  registerUpstream(sock, id) {
    this.upstreams[id] = sock;
    this.logger.info(`upstream "${id}" registered`);
    sock
      .on('disconnect', () => { delete this.upstreams[id]; })
      .on('broker_request_ack', payload => this.handleBrokerRequestAck(payload))
      .on('upstream_error', payload => this.handleUpstreamError(payload))
      .on('upstream_response', payload => this.handleUpstreamResponse(payload));
  }

  handleBrokerRequestAck() {}   // NO-OP

  handleUpstreamError(payload) {
    this.logger.trace(payload);
    this.sendBrokerError(payload.broker_req_id, payload.error);
  }

  handleUpstreamResponse(payload) {
    this.logger.trace(payload);
    var request = this.requests[payload.broker_req_id];
    if(!request) return;
    var csock = this.clients[request.client_sock];
    if(!csock) return;  // TODO: anything else to do here?

    this.logger.debug(`sending ${request.id} broker response`);
    this.removeRequest(request.id);
    csock.emit('broker_response', payload);
  }

  handleClientRequest(cid, payload) {
    this.logger.trace(payload);
    var csock = this.clients[cid];
    if(!csock) return;
    const id = uuid();
    const ttl = Date.now() + this.req_ttl;
    var request = payload;
    request.id = id;
    request.client_sock = cid;
    request.upstream_sock = payload.upstream_target;
    request.ttl = ttl;
    request.timeout = setTimeout(this.handleRequestTimeout.bind(this), this.req_ttl, id);
    this.requests[id] = request;

    var usock = this.upstreams[payload.upstream_target];
    if(!usock) return this.sendBrokerError(id, new Error(`Upstream target "${payload.upstream_target}" not found`));

    this.logger.info(`sending request ${id} with ttl ${ttl}`);
    usock.emit('broker_request', {
      client_id: request.client_id,
      client_req_id: request.client_req_id,
      client_req_ttl: request.client_req_ttl,
      upstream_target: request.upstream_target,
      method: request.method,
      url: request.url,
      headers: request.headers,
      body: request.body,
      broker_id: this.id,
      broker_req_id: request.id,
      broker_req_ttl: request.ttl
    });
  }

  sendBrokerError(id, err) {
    var request = this.requests[id];
    if(!request) return;
    var csock = this.clients[request.client_sock];
    if(!csock) return;
    this.logger.debug(`sending ${request.id} broker error ${err.name}: ${err.message}`);
    this.removeRequest(request.id);


    csock.emit('broker_error', {client_req_id: request.client_req_id, error: err});
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

module.exports = Broker;
