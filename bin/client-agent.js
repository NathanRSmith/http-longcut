const yargs = require('yargs')
  .option('id', {description: 'client agent id', type: 'string', required: true})
  .option('port', {description: 'port to listen on', type: 'string', required: true})
  .option('socketio-port', {description: 'port for socketio server to listen on', type: 'string'})
  .option('upstream-target', {description: 'upstream target name', type: 'string', required: true})
  .option('broker', {description: 'broker address', type: 'string', required: true})
  .option('v', {alias: 'verbosity', description: 'Logger verbosity level', default: 'info', choices: ['fatal', 'error', 'warn', 'info', 'debug', 'trace']})
  .help('help')
  .alias('h', 'help');
const argv = yargs.argv;

const io = require('socket.io-client');
const ioserver = require('socket.io');
const url = require('url');
const http = require('http');
const ClientAgent = require('../lib/ClientAgent');
const bunyan = require('bunyan');
const logger = bunyan.createLogger({
  name: 'longcut-client',
  level: argv.verbosity
});

// listen for http requests
const server = http.createServer();
const socket = io(argv.broker);
let socketio_server;
if(argv['socketio-port']) {
  socketio_server = ioserver();
  socketio_server.use(require('socketio-wildcard')());
}

const clientAgent = new ClientAgent({
  id: argv.id,
  server: server,
  socket: socket,
  socketio_server: socketio_server,
  upstream_target: argv['upstream-target'],
  logger: logger.child({client_id: argv.id})
});
clientAgent.register();

server.listen(argv.port);
logger.info(`listening on port ${argv.port}`);

if(socketio_server) {
  socketio_server.listen(argv['socketio-port']);
  logger.info(`Socket.IO listening on port ${argv['socketio-port']}`);
}
