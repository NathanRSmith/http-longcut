const yargs = require('yargs')
  .option('id', {description: 'client agent id', type: 'string', required: true})
  .option('target-address', {description: 'target address', type: 'string', required: true})
  .option('broker', {description: 'broker address', type: 'string', required: true})
  .option('v', {alias: 'verbosity', description: 'Logger verbosity level', choices: ['fatal', 'error', 'warn', 'info', 'debug', 'trace']})
  .help('help')
  .alias('h', 'help');
const argv = yargs.argv;

const io = require('socket.io-client');
const url = require('url');
const request = require('request');
const UpstreamAgent = require('../lib/UpstreamAgent');

const logger = {
  fatal: console.log,
  error: console.log,
  warn: console.log,
  info: console.log,
  debug: console.log,
  trace: console.log,
  child: () => logger
};

const socket = io(argv.broker);
const http = function(args, cb) {
  return request(args, cb);
}

const upstreamAgent = new UpstreamAgent({
  id: argv.id,
  http: http,
  socket: socket,
  target_address: argv['target-address'],
  logger: logger.child({client_id: argv.id})
});
upstreamAgent.register();
