#!/usr/bin/env node
var net = require("net");
var fs = require("fs");
var ifaceConfFile = process.env.PDJL_CONFIG || 'iface.json';
console.log('Config: '+ifaceConfFile);
var ifaceConf = JSON.parse(fs.readFileSync(ifaceConfFile));
var DJMDevice = require('./libdjm.js').DJMDevice;

var device = new DJMDevice;
//device.setConfigureCDJ2000NXS();
//device.channel = ifaceConf.channel || 4;
device.setConfigureRekordbox();
device.channel = 0x11;
device.macaddr = ifaceConf.mac;
device.ipaddr = ifaceConf.ip;
device.broadcastIP = ifaceConf.bcast;
device.hostname = 'Bostons-Mac-Pro';
device.log = function(){};
console.log('Chan: '+device.channel.toString(16));
console.log('MAC: '+device.macaddr);
console.log('IP: '+device.ipaddr);
// configure media information
device.cdjMediaSource = null;
device.connect();
setTimeout(function(){
	//console.log('Mounting storage');
	//device.mountUSB();
}, 3000);


net.createServer(function(socket) {
	socket.on('data', function(data) {
		console.log('12523 Portmanager: ', data);
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


var udpProxy = require('./udpproxy.js');
udpProxy(50111, device.ipaddr, 111, '127.0.0.1');

var DBServer = require('./dbserver.js');
net.createServer(DBServer.handleDBServerConnection.bind(null, device)).listen(1051);

// 1. Boot normally, wait 3 more seconds
// 2. Load track off "SD card" and play it
// 3. become master
// 4. CDJ3 queries us for track information
// 5. CDJ3 queries us for the track data and position and tries to play it in sync

