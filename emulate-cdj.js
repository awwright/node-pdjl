#!/usr/bin/env node
var dgram = require("dgram");
var net = require("net");
var fs = require("fs");
var ifaceConfFile = process.env.PDJL_CONFIG || 'iface.json';
console.log('Config: '+ifaceConfFile);
var ifaceConf = JSON.parse(fs.readFileSync(ifaceConfFile));
var DJMDevice = require('./libdjm.js').DJMDevice;

var device = new DJMDevice;
device.channel = ifaceConf.channel || 4;
device.macaddr = ifaceConf.mac;
device.ipaddr = ifaceConf.ip;
device.broadcastIP = ifaceConf.bcast;
device.cdjMediaSource = 'cd';
console.log('Chan: '+device.channel);
console.log('MAC: '+device.macaddr);
console.log('IP: '+device.ipaddr);
device.connect();


net.createServer(function(socket) {
	console.log('NEW CONNECTION '+socket.localPort);
	socket.on('data', function(data) {
		console.log('Data: ', data);
		// This is the number of another port to connect to... why?
		// Send out port number 1051
		socket.write(Buffer([0x04, 0x1b]));
	});
	socket.on('end', function() {
		console.log('Connection closed');
	});
	// start the flow of data, discarding it.
	socket.resume();
}).listen(12523);

net.createServer(function(socket) {
	console.log('NEW CONNECTION '+socket.localPort);
	var state = socket.state = {};
	state.length = 0;
	state.initialized = 0;
	socket.on('data', function(data) {
		state.length += data.length;
		console.log('Data: ', data);
		if(state.initialized===0){
			socket.write(data);
			state.initialized = 1;
		}
	});
	socket.on('end', function() {
		console.log('Connection closed');
	});
	// start the flow of data, discarding it.
	socket.resume();
}).listen(1051);


function watchTCPPort(port){
	console.log('Watching TCP '+port);
	net.createServer(function(socket) {
		console.log('NEW CONNECTION '+socket.localPort);
		socket.on('data', function(data) {
		console.log('Data: ', data);
		});
		socket.on('end', function() {
			console.log('Connection closed');
		});
		// start the flow of data, discarding it.
		socket.resume();
	}).listen(port);
}
watchTCPPort(1053);
watchTCPPort(1054);

// 1. Boot normally, wait 3 more seconds
// 2. Load track off "SD card" and play it
// 3. become master
// 4. CDJ3 queries us for track information
// 5. CDJ3 queries us for the track data and position and tries to play it in sync

