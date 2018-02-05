const _ = require('lodash');
const uuid = require('uuid/v4');

const DEFAULT_TTL = 10*1000;
class UpstreamAgent {
  constructor (args) {
    this.id = args.id;
    this.http = args.http;
    this.socket = args.socket;
    this.target_address = args.target_address;
    this.logger = args.logger;
    this.req_ttl = args.req_ttl || DEFAULT_TTL;
    this.requests = {};

    this.socket.on('broker_request', this.handleBrokerRequest.bind(this));
  }

  // broker_request (receives)
  handleBrokerRequest(payload) {
    const id = uuid();
    const ttl = Date.now() + this.req_ttl;
    this.logger.info(`sending request ${id} broker msg ${payload.broker_req_id} with ttl ${ttl}`);

    var request = payload;
    request.id = id;
    this.requests[id] = request;
    // TODO: ttl

    this.http(
      {
        method: request.method,
        // TODO: change url
        url: request.url,
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

    this.socket.emit('upstream_error', {
      broker_req_id: request.broker_req_id,
      error: err
    });
  }

}

module.exports = UpstreamAgent;
