const io = require('socket.io-client');

let socket = io('http://localhost:8000');
// let socket = io('http://au2:7901');


const IGNORE = [
  'connect',
  'connect_error',
  'connect_timeout',
  'error',
  'disconnect',
  'reconnect',
  'reconnect_attempt',
  'reconnecting',
  'reconnect_error',
  'reconnect_failed',
  'ping',
  'pong'
];

const EventEmitter = require('events');
var onevent = socket.onevent;
socket.onevent = function(...args) {
  console.log('here', args[0].data)
  console.log(['*'].concat(args[0].data))
  debugger
  EventEmitter.prototype.emit.apply(socket, ['*'].concat(args[0].data));
  onevent.apply(socket, args);
}
console.log(EventEmitter.prototype.emit)

socket.on('*', console.log)


// socket.emit = console.log

// const ioStarPatch = require('socketio-wildcard')(socket.prototype);
// ioStarPatch(socket);

socket.on('connect', () => {
  socket.emit('authenticate', {token: 'fail'})
  // socket.emit = console.log
  //
  // console.log('connect')
  // socket.on('*', (evt, ...args) => console.log(evt, args))
  socket.on('unauthorized', console.log)
})

// setTimeout(() => console.log(socket), 7500)
