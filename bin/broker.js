const yargs = require('yargs')
  .option('id', {description: 'client agent id', type: 'string', required: true})
  .option('port', {description: 'port to listen on', type: 'string', required: true})
  .option('v', {alias: 'verbosity', description: 'Logger verbosity level', choices: ['fatal', 'error', 'warn', 'info', 'debug', 'trace']})
  .help('help')
  .alias('h', 'help');
const argv = yargs.argv;

const io = require('socket.io');
const url = require('url');
const http = require('http');
const Broker = require('../lib/Broker');

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
const server = http.createServer();
const socket = io(server);

const broker = new Broker({
  id: argv.id,
  socket: socket,
  logger: logger.child({client_id: argv.id})
});

server.listen(argv.port);
logger.info(`listening on port ${argv.port}`);
