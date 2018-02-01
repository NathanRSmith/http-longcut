const yargs = require('yargs')
  .option('s', {'alias': 'shared', 'description': 'shared server address', type: 'string'})
  .option('t', {'alias': 'target', 'description': 'target server address', type: 'string'})
  .help('help')
  .alias('h', 'help');
const argv = yargs.argv;

const io = require('socket.io-client');
const request = require('request');
const url = require('url');

const socket = io(argv.shared);

socket.on('request', data => {
  console.log(`request`, JSON.stringify(data))
  request({
    method: data.method,
    url: url.resolve(argv.target, data.url),
    headers: data.headers
  }, (err, rep, body) => {
    if(err) return console.error(data.id, err);
    socket.emit('reply', {
      id: data.id,
      headers: rep.headers,
      body: body,
      status: rep.statusCode
    });
  })
});