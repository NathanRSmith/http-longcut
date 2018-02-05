// args: id, upstream-name, broker-address
const yargs = require('yargs')
  .option('id', {description: 'client agent id', type: 'string', required: true})
  .option('port', {description: 'port to listen on', type: 'string', required: true})
  .option('upstream-target', {description: 'upstream target name', type: 'string', required: true})
  .option('broker', {description: 'broker address', type: 'string', required: true})
  .option('v', {alias: 'verbosity', description: 'Logger verbosity level', choices: ['fatal', 'error', 'warn', 'info', 'debug', 'trace']})
  .help('help')
  .alias('h', 'help');
const argv = yargs.argv;

const io = require('socket.io-client');
const url = require('url');
const http = require('http');

const logger = {
  fatal: console.log,
  error: console.log,
  warn: console.log,
  info: console.log,
  debug: console.log,
  trace: console.log,
  child: () => logger
};

// listen for http requests
// auto parse body
const server = http.createServer();
const socket = io(argv.broker);

const clientAgent = new ClientAgent({
  id: argv.id,
  server: server,
  socket: socket,
  upstream_target: argv['upstream-target'],
  logger: logger.child({client_id: argv.id})
});

server.listen(argv.port);
