#!/usr/bin/env node
var dgram = require("dgram");
var net = require("net");

var ifaceConf = require('./iface.json');
var DJMDevice = require('./libdjm.js').DJMDevice;

var device = new DJMDevice;
device.channel = ifaceConf.channel || 4;
device.macaddr = ifaceConf.mac;
device.ipaddr = ifaceConf.ip;
console.log('Chan: '+device.channel);
console.log('MAC: '+device.macaddr);
console.log('IP: '+device.ipaddr);

var sock0 = device.sock0 = dgram.createSocket("udp4");
var sock1 = device.sock1 = dgram.createSocket("udp4");
var sock2 = device.sock2 = dgram.createSocket("udp4");

sock0.on("message", device.onMsg0.bind(device));
sock1.on("message", device.onMsg1.bind(device));
sock2.on("message", device.onMsg2.bind(device));

sock0.on("listening", function () {
	var address = sock0.address();
	console.log("server listening " +	address.address + ":" + address.port);
});
sock1.on("listening", function () {
	var address = sock1.address();
	console.log("server listening " +	address.address + ":" + address.port);
});
sock2.on("listening", function () {
	var address = sock2.address();
	console.log("server listening " +	address.address + ":" + address.port);
});

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

var waiting = 3;
sock0.bind(50000, device.ipaddr, function onBound0(){
	console.log('bound0');
	sock0.setBroadcast(true);
	doneBind();
});
sock1.bind(50001, device.ipaddr, function onBound1(){
	console.log('bound1');
	sock1.setBroadcast(true);
	doneBind();
});
sock2.bind(50002, device.ipaddr, function onBound2(){
	console.log('bound2');
	sock2.setBroadcast(true);
	doneBind();
});
function doneBind(){
	if(--waiting===0){
		device.boot();
	}
}

