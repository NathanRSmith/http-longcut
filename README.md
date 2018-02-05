# HTTP-LongCut ("The long way round")

The goal here is to be able to get HTTP requests from one network to another via some common access point. There are 3 components: client agent, request broker and upstream agent. HTTP requests sent to the client agent are transformed into broker-able requests and sent to the request broker. The request broker will chose the connected agent which claims to be able to handle to the specified upstream name and send the request to that upstream agent. The upstream agent will issue a regular HTTP request to the configured upstream server as if the client had issued it themselves. On receiving a response, the reply is sent back along the same path. The broker will wait a configured amount of time if a registered upstream agent is not available for the requested name. The broker will wait a configured amount of time for the upstream agent to acknowledge the request. The broker will wait a configured amount of time for a reply to be received.

Request/response bodies are expected to be small.

Request structure:
* client_id
* client_req_id
* client_req_ttl
* upstream_target
* method
* url
* headers
* body
* broker_id
* broker_req_id
* broker_req_ttl
* upstream_id
* upstream_req_id
* upstream_req_ttl

Response structure:
* client_req_id
* broker_req_id
* upstream_req_id
* status_code
* headers
* body


Client Agent Events:
* client_request (sends): Initiates request to be proxied
    * payload: request object with client fields, upstream_target, headers & body
* client_request_ack (receives): Indicates a request was received by the broker
    * payload: client_req_id & broker_req_id
* broker_response (receives): Response from upstream agent
    * payload: response object
* broker_error (receives): Indicates an error occurred while broker or upstream handling a request
    * payload: client_req_id & error object

Broker Events:
* client_request (receives): Request from client agent
    * payload: request object
* client_request_ack (sends): Indicates a request was received
    * payload: client_req_id & broker_req_id
* broker_request (sends): Sends a request to upstream agent
* broker_request_ack (receives): Indicates a request received upstream
    * payload: broker_req_id & upstream_req_id
* upstream_response (receives): Response from upstream agent
* broker_response (sends): Sends response from upstream agent
* upstream_error (receives): Indicates an error occurred while upstream handling a request
    * payload: broker_req_id & error object
* broker_error (sends): Indicates an error occurred while broker or upstream handling a request
    * payload: client_req_id & error object

Upstream Agent Events:
* broker_request (receives)
* broker_request_ack (sends)
* upstream_response (sends)
* upstream_error (sends)
