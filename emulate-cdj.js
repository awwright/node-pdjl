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
console.log('Chan: '+device.channel);
console.log('MAC: '+device.macaddr);
console.log('IP: '+device.ipaddr);
device.connect();

function watchTCPPort(port){
	console.log('Watching TCP '+port);
	net.createServer(function(socket) {
		console.log('NEW CONNECTION '+port, socket);
		socket.on('end', function() {
			socket.end('I got your message (but didnt read it)\n');
		});
		// start the flow of data, discarding it.
		socket.resume();
	}).listen(port);
}
watchTCPPort(1051);
watchTCPPort(1053);
watchTCPPort(1054);
watchTCPPort(12523);

