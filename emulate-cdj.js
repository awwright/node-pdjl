#!/usr/bin/env node
var dgram = require("dgram");
var net = require("net");

var ifaceConf = require('./iface.json');
var DJMDevice = require('./libdjm.js').DJMDevice;

var device = new DJMDevice;
device.channel = ifaceConf.channel || 4;
device.macaddr = ifaceConf.mac;
device.ipaddr = ifaceConf.ip;
device.broadcastIP = ifaceConf.bcast;
console.log('Chan: '+device.channel);
console.log('MAC: '+device.macaddr);
console.log('IP: '+device.ipaddr);

var waiting = 0;

function listenUDP(addr, port, fn){
	var sock = dgram.createSocket("udp4");
	sock.on("message", function(v, w){
		//console.log(v);
		fn(v, w);
	});
	sock.on("listening", function () {
		var address = sock.address();
		console.log("server listening " +	address.address + ":" + address.port);
	});
	sock.bind(port, addr, function onBound(){
		console.log('bound');
		sock.setBroadcast(true);
		doneBind();
	});
	waiting++;
	return sock;
}

device.sock0 = listenUDP(device.ipaddr, 50000, device.onMsg0.bind(device));
device.sock0b = listenUDP(device.broadcastIP, 50000, device.onMsg0.bind(device));
device.sock1 = listenUDP(device.ipaddr, 50001, device.onMsg1.bind(device));
device.sock1b = listenUDP(device.broadcastIP, 50001, device.onMsg1.bind(device));
device.sock2 = listenUDP(device.ipaddr, 50002, device.onMsg2.bind(device));
device.sock2b = listenUDP(device.broadcastIP, 50002, device.onMsg2.bind(device));

function doneBind(){
	if(--waiting===0){
		console.log('Starting boot');
		device.boot();
	}
}

net.createServer(function(socket) {
	console.log('NEW CONNECTION 12523', socket);
	socket.on('end', function() {
		socket.end('I got your message (but didnt read it)\n');
	});
	// start the flow of data, discarding it.
	socket.resume();
}).listen(12523);


net.createServer(function(socket) {
	console.log('NEW CONNECTION 1053', socket);
	socket.on('end', function() {
		socket.end('I got your message (but didnt read it)\n');
	});
	// start the flow of data, discarding it.
	socket.resume();
}).listen(1053);

net.createServer(function(socket) {
	console.log('NEW CONNECTION 1051', socket);
	socket.on('end', function() {
		socket.end('I got your message (but didnt read it)\n');
	});
	// start the flow of data, discarding it.
	socket.resume();
}).listen(1051);


