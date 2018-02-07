const yargs = require('yargs')
  .option('id', {description: 'client agent id', type: 'string', required: true})
  .option('target-address', {description: 'target address', type: 'string', required: true})
  .option('socketio-address', {description: 'socketio address', type: 'string'})
  .option('broker', {description: 'broker address', type: 'string', required: true})
  .option('v', {alias: 'verbosity', description: 'Logger verbosity level', default: 'info', choices: ['fatal', 'error', 'warn', 'info', 'debug', 'trace']})
  .help('help')
  .alias('h', 'help');
const argv = yargs.argv;

const io = require('socket.io-client');
const ioStarPatch = require('socketio-wildcard')(io.Manager);
const url = require('url');
const request = require('request');
const UpstreamAgent = require('../lib/UpstreamAgent');
const bunyan = require('bunyan');
const logger = bunyan.createLogger({
  name: 'longcut-upstream',
  level: argv.verbosity
});

// const logger = {
//   fatal: console.log,
//   error: console.log,
//   warn: console.log,
//   info: console.log,
//   debug: console.log,
//   trace: console.log,
//   child: () => logger
// };


const socket = io(argv.broker);
const http = function(args, cb) {
  return request(args, cb);
}

let socketio_builder;
if(argv['socketio-address']) {
  socketio_builder = function() {
    let socket = io(argv['socketio-address']);
    ioStarPatch(socket);
    return socket;
  }
}

const upstreamAgent = new UpstreamAgent({
  id: argv.id,
  http: http,
  socket: socket,
  socketio_builder: socketio_builder,
  target_address: argv['target-address'],
  logger: logger.child({client_id: argv.id})
});
upstreamAgent.register();
