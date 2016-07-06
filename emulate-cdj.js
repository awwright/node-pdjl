#!/usr/bin/env node
var dgram = require("dgram");
var net = require("net");
var fs = require("fs");
var ifaceConfFile = process.env.PDJL_CONFIG || 'iface.json';
console.log('Config: '+ifaceConfFile);
var ifaceConf = JSON.parse(fs.readFileSync(ifaceConfFile));
var DJMDevice = require('./libdjm.js').DJMDevice;

var device = new DJMDevice;
device.setConfigureCDJ2000NXS();
device.channel = ifaceConf.channel || 4;
//device.setConfigureRekordbox();
//device.channel = 0x11;
device.macaddr = ifaceConf.mac;
device.ipaddr = ifaceConf.ip;
device.broadcastIP = ifaceConf.bcast;
device.hostname = 'Bostons-Mac-Pro';
console.log('Chan: '+device.channel);
console.log('MAC: '+device.macaddr);
console.log('IP: '+device.ipaddr);
// configure media information
device.cdjMediaSource = null;
device.connect();
setTimeout(function(){
	console.log('Mounting SD');
	device.mountSD();
}, 15000);


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
	state.buffer = new Buffer(0); // Hold onto packets while they're incomplete
	socket.on('data', function(data) {
		state.length += data.length;
		console.log('Incoming: ', data);
		var magic_handshake = new Buffer([0x11, 0x00, 0x00, 0x00, 0x01]);

		if(state.initialized===0){
			if(data.compare(magic_handshake)!=0){
				console.error(magic_handshake);
				console.error(data);
				throw new Error('Connection init handshake: Invalid handshake');
			}
			// This 'Hello' always seems to be the same five bytes, in both directions: 0x11.00.00.00.01
			socket.write(magic_handshake);
			state.initialized = 1;
			return;
		}
		var magic_header = new Buffer([0x11, 0x87, 0x23, 0x49, 0xae, 0x11]);
		if(data.slice(0,6).compare(magic_header)!=0){
			console.error(magic_header);
			console.error(data);
			throw new Error('Invalid checksum header?');
		}
		var incoming_hello_1 = new Buffer([
			0x11, 0x87, 0x23, 0x49, 0xae, 0x11, 0xff, 0xff,
			0xff, 0xfe, 0x10, 0x00, 0x00, 0x0f, 0x01, 0x14,
			0x00, 0x00, 0x00, 0x0c, 0x06, 0x00, 0x00, 0x00,
			0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
			0x11, 0x00, 0x00, 0x00, 0x03 ]);
		if(data.compare(incoming_hello_1)==0){
			console.log('Incoming data matches incoming_hello_1');
			var chan = device.channel;
			var response_hello_1 = new Buffer([
				0x11, 0x87, 0x23, 0x49, 0xae, 0x11, 0xff, 0xff,
				0xff, 0xfe, 0x10, 0x40, 0x00, 0x0f, 0x02, 0x14,
				0x00, 0x00, 0x00, 0x0c, 0x06, 0x06, 0x00, 0x00,
				0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
				0x11, 0x00, 0x00, 0x00, 0x00, 0x11, 0x00, 0x00,
				0x00, chan ]);
			socket.write(response_hello_1);
			return;
		}
		// A packet like this is sent out just before every 'primary' request that will return the actual track data
		// Who knows what it does?
		//	0x11, 0x87, 0x23, 0x49, 0xae, 0x11, 0x03, 0x80, 0x00, 0xNN, 0x10, 0xWW, 0x02, 0x0f, 0x02, 0x14,
		//	0x00, 0x00, 0x00, 0x0c, 0x06, 0x06, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		//	0x11, 0x03, 0x01, 0xXX, 0xYY, 0x11, 0x00, 0x00, 0x00, 0xZZ, ]);
		var incoming_hello_2b = new Buffer([ 0x03, 0x80 ]);
		if(data.slice(6,8).compare(incoming_hello_2b)==0 && data[0xe]==0x02 && data[0xf]==0x14){
			console.log('Incoming data matches incoming_prerequest');
			var response_prerequest = new Buffer([
				0x11, 0x87, 0x23, 0x49, 0xae, 0x11, 0x03, 0x80,
				0x00, 0x03, 0x10, 0x40, 0x00, 0x0f, 0x02, 0x14,
				0x00, 0x00, 0x00, 0x0c, 0x06, 0x06, 0x00, 0x00,
				0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
				0x11, 0x00, 0x00, 0x22, 0x02, 0x11, 0x00, 0x00,
				0x00, 0x0a ]);
			response_prerequest[0x09] = data[0x09];
			response_prerequest[0x23] = data[0x0b];
			socket.write(response_prerequest);
			return;
		}
		if(data.slice(0,8).compare(incoming_hello_2b)==0 && data[0xe]==0x06 && data[0xf]==0x14){
			console.log('Incoming data matches incoming_request');
			var pkid = data[9];
			var response_request = new Buffer([
				0x11, 0x87, 0x23, 0x49, 0xae, 0x11, 0x03, 0x80,
				0x00, pkid, 0x10, 0x40, 0x01, 0x0f, 0x02, 0x14,
				0x00, 0x00, 0x00, 0x0c, 0x06, 0x06, 0x00, 0x00,
				0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
				0x11, 0x00, 0x00, 0x00, 0x01, 0x11, 0x00, 0x00,
				0x00, 0x00, 0x11, 0x87, 0x23, 0x49, 0xae, 0x11,
				0x03, 0x80, 0x00, pkid, 0x10, 0x41, 0x01, 0x0f,
				0x0c, 0x14, 0x00, 0x00, 0x00, 0x0c, 0x06, 0x06,
				0x06, 0x02, 0x06, 0x02, 0x06, 0x06, 0x06, 0x06,
				0x06, 0x06, 0x11, 0x00, 0x00, 0x00, 0x00, 0x11,
				0x00, 0x00, 0x00, 0x01, 0x11, 0x00, 0x00, 0x00,
				0x10, 0x26, 0x00, 0x00, 0x00, 0x08, 0x00, 0x45,
				0x00, 0x6d, 0x00, 0x62, 0x00, 0x72, 0x00, 0x61,
				0x00, 0x63, 0x00, 0x65, 0x00, 0x00, 0x11, 0x00,
				0x00, 0x00, 0x02, 0x26, 0x00, 0x00, 0x00, 0x01,
				0x00, 0x00, 0x11, 0x00, 0x00, 0x00, 0x04, 0x11,
				0x05, 0x00, 0x00, 0x00, 0x11, 0x00, 0x00, 0x00,
				0x00, 0x11, 0x00, 0x00, 0x00, 0x00, 0x11, 0x00,
				0x00, 0x00, 0x00, 0x11, 0x00, 0x00, 0x00, 0x00,
				0x11, 0x87, 0x23, 0x49, 0xae, 0x11, 0x03, 0x80,
				0x00, pkid, 0x10, 0x41, 0x01, 0x0f, 0x0c, 0x14,
				0x00, 0x00, 0x00, 0x0c, 0x06, 0x06, 0x06, 0x02,
				0x06, 0x02, 0x06, 0x06, 0x06, 0x06, 0x06, 0x06,
				0x11, 0x00, 0x00, 0x00, 0x00, 0x11, 0x00, 0x00,
				0x00, 0x01, 0x11, 0x00, 0x00, 0x00, 0x4c, 0x26,
				0x00, 0x00, 0x00, 0x26, 0x00, 0x41, 0x00, 0x72,
				0x00, 0x6d, 0x00, 0x69, 0x00, 0x6e, 0x00, 0x20,
				0x00, 0x76, 0x00, 0x61, 0x00, 0x6e, 0x00, 0x20,
				0x00, 0x42, 0x00, 0x75, 0x00, 0x75, 0x00, 0x72,
				0x00, 0x65, 0x00, 0x6e, 0x00, 0x20, 0x00, 0x66,
				0x00, 0x65, 0x00, 0x61, 0x00, 0x74, 0x00, 0x2e,
				0x00, 0x20, 0x00, 0x45, 0x00, 0x72, 0x00, 0x69,
				0x00, 0x63, 0x00, 0x20, 0x00, 0x56, 0x00, 0x6c,
				0x00, 0x6f, 0x00, 0x65, 0x00, 0x69, 0x00, 0x6d,
				0x00, 0x61, 0x00, 0x6e, 0x00, 0x73, 0x00, 0x00,
				0x11, 0x00, 0x00, 0x00, 0x02, 0x26, 0x00, 0x00,
				0x00, 0x01, 0x00, 0x00, 0x11, 0x00, 0x00, 0x00,
				0x07, 0x11, 0x00, 0x00, 0x00, 0x00, 0x11, 0x00,
				0x00, 0x00, 0x00, 0x11, 0x00, 0x00, 0x00, 0x00,
				0x11, 0x00, 0x00, 0x00, 0x00, 0x11, 0x00, 0x00,
				0x00, 0x00, 0x11, 0x87, 0x23, 0x49, 0xae, 0x11,
				0x03, 0x80, 0x00, pkid, 0x10, 0x41, 0x01, 0x0f,
				0x0c, 0x14, 0x00, 0x00, 0x00, 0x0c, 0x06, 0x06,
				0x06, 0x02, 0x06, 0x02, 0x06, 0x06, 0x06, 0x06,
				0x06, 0x06, 0x11, 0x00, 0x00, 0x00, 0x00, 0x11,
				0x00, 0x00, 0x00, 0x01, 0x11, 0x00, 0x00, 0x00,
				0x10, 0x26, 0x00, 0x00, 0x00, 0x08, 0x00, 0x45,
				0x00, 0x6d, 0x00, 0x62, 0x00, 0x72, 0x00, 0x61,
				0x00, 0x63, 0x00, 0x65, 0x00, 0x00, 0x11, 0x00,
				0x00, 0x00, 0x02, 0x26, 0x00, 0x00, 0x00, 0x01,
				0x00, 0x00, 0x11, 0x00, 0x00, 0x00, 0x02, 0x11,
				0x00, 0x00, 0x00, 0x00, 0x11, 0x00, 0x00, 0x00,
				0x00, 0x11, 0x00, 0x00, 0x00, 0x00, 0x11, 0x00,
				0x00, 0x00, 0x00, 0x11, 0x00, 0x00, 0x00, 0x00,
				0x11, 0x87, 0x23, 0x49, 0xae, 0x11, 0x03, 0x80,
				0x00, pkid, 0x10, 0x41, 0x01, 0x0f, 0x0c, 0x14,
				0x00, 0x00, 0x00, 0x0c, 0x06, 0x06, 0x06, 0x02,
				0x06, 0x02, 0x06, 0x06, 0x06, 0x06, 0x06, 0x06,
				0x11, 0x00, 0x00, 0x00, 0x00, 0x11, 0x00, 0x00,
				0x01, 0xc8, 0x11, 0x00, 0x00, 0x00, 0x02, 0x26,
				0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x11, 0x00,
				0x00, 0x00, 0x02, 0x26, 0x00, 0x00, 0x00, 0x01,
				0x00, 0x00, 0x11, 0x00, 0x00, 0x00, 0x0b, 0x11,
				0x00, 0x00, 0x00, 0x00, 0x11, 0x00, 0x00, 0x00,
				0x00, 0x11, 0x00, 0x00, 0x00, 0x00, 0x11, 0x00,
				0x00, 0x00, 0x00, 0x11, 0x00, 0x00, 0x00, 0x00,
				0x11, 0x87, 0x23, 0x49, 0xae, 0x11, 0x03, 0x80,
				0x00, pkid, 0x10, 0x41, 0x01, 0x0f, 0x0c, 0x14,
				0x00, 0x00, 0x00, 0x0c, 0x06, 0x06, 0x06, 0x02,
				0x06, 0x02, 0x06, 0x06, 0x06, 0x06, 0x06, 0x06,
				0x11, 0x00, 0x00, 0x00, 0x00, 0x11, 0x00, 0x00,
				0x00, 0x00, 0x11, 0x00, 0x00, 0x00, 0x02, 0x26,
				0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x11, 0x00,
				0x00, 0x00, 0x02, 0x26, 0x00, 0x00, 0x00, 0x01,
				0x00, 0x00, 0x11, 0x00, 0x00, 0x00, 0x0d, 0x11,
				0x00, 0x00, 0x00, 0x00, 0x11, 0x00, 0x00, 0x00,
				0x00, 0x11, 0x00, 0x00, 0x00, 0x00, 0x11, 0x00,
				0x00, 0x00, 0x00, 0x11, 0x00, 0x00, 0x00, 0x00,
				0x11, 0x87, 0x23, 0x49, 0xae, 0x11, 0x03, 0x80,
				0x00, pkid, 0x10, 0x41, 0x01, 0x0f, 0x0c, 0x14,
				0x00, 0x00, 0x00, 0x0c, 0x06, 0x06, 0x06, 0x02,
				0x06, 0x02, 0x06, 0x06, 0x06, 0x06, 0x06, 0x06,
				0x11, 0x00, 0x00, 0x00, 0x00, 0x11, 0x00, 0x00,
				0x00, 0x01, 0x11, 0x00, 0x00, 0x00, 0x02, 0x26,
				0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x11, 0x00,
				0x00, 0x00, 0x02, 0x26, 0x00, 0x00, 0x00, 0x01,
				0x00, 0x00, 0x11, 0x00, 0x00, 0x00, 0x23, 0x11,
				0x00, 0x00, 0x00, 0x00, 0x11, 0x00, 0x00, 0x00,
				0x00, 0x11, 0x00, 0x00, 0x00, 0x00, 0x11, 0x00,
				0x00, 0x00, 0x00, 0x11, 0x00, 0x00, 0x00, 0x00,
				0x11, 0x87, 0x23, 0x49, 0xae, 0x11, 0x03, 0x80,
				0x00, pkid, 0x10, 0x41, 0x01, 0x0f, 0x0c, 0x14,
				0x00, 0x00, 0x00, 0x0c, 0x06, 0x06, 0x06, 0x02,
				0x06, 0x02, 0x06, 0x06, 0x06, 0x06, 0x06, 0x06,
				0x11, 0x00, 0x00, 0x00, 0x00, 0x11, 0x00, 0x00,
				0x00, 0x01, 0x11, 0x00, 0x00, 0x00, 0x02, 0x26,
				0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x11, 0x00,
				0x00, 0x00, 0x02, 0x26, 0x00, 0x00, 0x00, 0x01,
				0x00, 0x00, 0x11, 0x00, 0x00, 0x00, 0x06, 0x11,
				0x00, 0x00, 0x00, 0x00, 0x11, 0x00, 0x00, 0x00,
				0x00, 0x11, 0x00, 0x00, 0x00, 0x00, 0x11, 0x00,
				0x00, 0x00, 0x00, 0x11, 0x00, 0x00, 0x00, 0x00,
				0x11, 0x87, 0x23, 0x49, 0xae, 0x11, 0x03, 0x80,
				0x00, pkid, 0x10, 0x41, 0x01, 0x0f, 0x0c, 0x14,
				0x00, 0x00, 0x00, 0x0c, 0x06, 0x06, 0x06, 0x02,
				0x06, 0x02, 0x06, 0x06, 0x06, 0x06, 0x06, 0x06,
				0x11, 0x00, 0x00, 0x00, 0x00, 0x11, 0xff, 0xff,
				0xff, 0xff, 0x11, 0x00, 0x00, 0x00, 0x02, 0x26,
				0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x11, 0x00,
				0x00, 0x00, 0x02, 0x26, 0x00, 0x00, 0x00, 0x01,
				0x00, 0x00, 0x11, 0x00, 0x00, 0x00, 0x0a, 0x11,
				0x00, 0x00, 0x00, 0x00, 0x11, 0x00, 0x00, 0x00,
				0x00, 0x11, 0x00, 0x00, 0x00, 0x00, 0x11, 0x00,
				0x00, 0x00, 0x00, 0x11, 0x00, 0x00, 0x00, 0x00,
				0x11, 0x87, 0x23, 0x49, 0xae, 0x11, 0x03, 0x80,
				0x00, pkid, 0x10, 0x41, 0x01, 0x0f, 0x0c, 0x14,
				0x00, 0x00, 0x00, 0x0c, 0x06, 0x06, 0x06, 0x02,
				0x06, 0x02, 0x06, 0x06, 0x06, 0x06, 0x06, 0x06,
				0x11, 0x00, 0x00, 0x00, 0x00, 0x11, 0x00, 0x00,
				0x00, 0xff, 0x11, 0x00, 0x00, 0x00, 0x02, 0x26,
				0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x11, 0x00,
				0x00, 0x00, 0x02, 0x26, 0x00, 0x00, 0x00, 0x01,
				0x00, 0x00, 0x11, 0x00, 0x00, 0x00, 0x13, 0x11,
				0x00, 0x00, 0x00, 0x00, 0x11, 0x00, 0x00, 0x00,
				0x00, 0x11, 0x00, 0x00, 0x00, 0x00, 0x11, 0x00,
				0x00, 0x00, 0x00, 0x11, 0x00, 0x00, 0x00, 0x00,
				0x11, 0x87, 0x23, 0x49, 0xae, 0x11, 0x03, 0x80,
				0x00, pkid, 0x10, 0x41, 0x01, 0x0f, 0x0c, 0x14,
				0x00, 0x00, 0x00, 0x0c, 0x06, 0x06, 0x06, 0x02,
				0x06, 0x02, 0x06, 0x06, 0x06, 0x06, 0x06, 0x06,
				0x11, 0x00, 0x00, 0x00, 0x00, 0x11, 0xff, 0xff,
				0xff, 0xff, 0x11, 0x00, 0x00, 0x00, 0x02, 0x26,
				0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x11, 0x00,
				0x00, 0x00, 0x02, 0x26, 0x00, 0x00, 0x00, 0x01,
				0x00, 0x00, 0x11, 0x00, 0x00, 0x00, 0x10, 0x11,
				0x00, 0x00, 0x00, 0x00, 0x11, 0x00, 0x00, 0x00,
				0x00, 0x11, 0x00, 0x00, 0x00, 0x00, 0x11, 0x00,
				0x00, 0x00, 0x00, 0x11, 0x00, 0x00, 0x00, 0x00,
				0x11, 0x87, 0x23, 0x49, 0xae, 0x11, 0x03, 0x80,
				0x00, pkid, 0x10, 0x42, 0x01, 0x0f, 0x00, 0x14,
				0x00, 0x00, 0x00, 0x0c, 0x00, 0x00, 0x00, 0x00,
				0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
				]);
			//var title = new Buffer("Haxxored", 'utf-8');
			//response_request.write(title, 0x4d, 0x4d+4, 'utf16le');
			//var author = new Buffer("Artist", 'utf-8');
			//response_request.write(author, 0xcb, 0xcb+4, 'utf16le');
			//var album = new Buffer("album", 'utf-8');
			//response_request.write(title, 0x4d, undefined, 'utf-16');
			response_request[0x5f] = 88;
			socket.write(response_request);
			return;
		}
		// Now let's try and figure out how to respond to a request for "Browse"
		// Included in the response seems to be:
		// - The first six or so menu items - only the ones being displayed
		// - The total number of menu items that can be scrolled through
		// - The fancy square brackets seem to be U+FFFA and U+FFFB
		// Album art and contents of submenus (that may be previewed) is acquired through a separate request
		// Responses are variable length, but where is the length field (if any)
		// Menu entries seem to be variable-length
		// - "ARTIST" (6) - 9
		// - "ALBUM" (5) - 8
		// - "TRACK" (5) - 8
		// - "KEY" (3) - 6
		// - "PLAYLIST" (8) - b
		// - "HISTORY" (7) - a
		// If we do this sequence:
		// 1. Boot up Rekordbox
		// 2. Press "Rekordbox" button and pull up browse
		// 3. Press "Link" on Rekordbox
		// Then we see the following requests go over the wire:
		// 1. 5-byte handshake
		// 2. [11 87 23 49 ae 11 ff ff  ff fe 10 00 00 0f 01 14] that seems to contain the sender's channel number, and is responded with the server's channel number
		// 3. [11 87 23 49 ae 11 03 80  00 9c 10 40 00 0f 02 14] that preceeds a menu request
		// 4. [11 87 23 49 ae 11 03 80  00 9d 10 30 00 0f 06 14] that is the actual request, responds with 6 menu items
		// 5. [11 87 23 49 ae 11 03 80  00 9e 10 10 02 0f 02 14] that preceeds a menu request
		// 6. [11 87 23 49 ae 11 03 80  00 9f 10 30 00 0f 06 14] that is the actual request for the "ARTIST" submenu
		throw new Error('Unknown incoming data/request');
	});
	socket.on('end', function() {
		console.log('Connection closed');
	});
	// start the flow of data, discarding it.
	socket.resume();
}).listen(1051);


// Forward portmap requests on the custom 50111 port to OS
// Right now this only works for one device at a time
var portmapPort = null;
var portmapIP = null;
var portmapServer = dgram.createSocket("udp4");
portmapServer.on("message", function(msg, rinfo){
	portmapPort = rinfo.port;
	portmapIP = rinfo.address;
	console.log('portmap request', msg, 111, '127.0.0.1');
	// When a request comes in from the CDJ, forward it to the OS
	portmapClient.send(msg, 0, msg.length, 111, '127.0.0.1');
});
portmapServer.on("listening", function () {
	var address = portmapServer.address();
	console.log("portmapServer listening " +	address.address + ":" + address.port);
});
portmapServer.bind(50111, device.ipaddr, function onBound(){
	console.log('portmapServer bound');
});

// And go OS->CDJ
var portmapClient = dgram.createSocket("udp4");
portmapClient.on("message", function(msg, rinfo){
	console.log('portmap response', msg, portmapPort, portmapIP);
	portmapServer.send(msg, 0, msg.length, portmapPort, portmapIP);
});
portmapClient.on("listening", function () {
	var address = portmapClient.address();
	console.log("portmapClient listening " +	address.address + ":" + address.port);
});
portmapClient.bind(0, '127.0.0.1', function onBound(){
	console.log('portmapClient bound');
});

// 1. Boot normally, wait 3 more seconds
// 2. Load track off "SD card" and play it
// 3. become master
// 4. CDJ3 queries us for track information
// 5. CDJ3 queries us for the track data and position and tries to play it in sync

