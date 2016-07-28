#!/usr/bin/env node
var net = require("net");
var fs = require("fs");
var ifaceConfFile = process.env.PDJL_CONFIG || 'iface.json';
console.log('Config: '+ifaceConfFile);
var ifaceConf = JSON.parse(fs.readFileSync(ifaceConfFile));
var DJMDevice = require('./libdjm.js').DJMDevice;
function debug(){
	console.log.apply(console, arguments);
}

var device = new DJMDevice;
device.setConfigureCDJ2000NXS();
device.channel = 0x4;
//device.setConfigureRekordbox();
//device.channel = 0x13;
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

device.onDeviceChange = function(){
	console.log('Device change', Object.keys(device.devices).map(function(v){ return v+':'+device.devices[v].modelName }));
}
device.onTrackChangeDetect = function(client){
	console.log('Track change', client.chan, client.currentTrack);
	device.getDBSSocket(client.chan, function(err, sock){
		console.log('Have DBServer reference...');
		//console.log('> Item2002');
		var firstRequestId = sock.issueRequest(new DBSt.Item2002({
			requestId: firstRequestId,
			clientChannel: device.channel,
			affectedMenu: 1,
			opt0_2: 2,
			resourceId: client.currentTrack,
		}), haveFirstRequest);
		function haveFirstRequest(err, data, info){
			//console.log('> Item3000');
			var menuRequestId = sock.issueRequest(new DBSt.Item30({
				requestId: menuRequestId,
				clientChannel: device.channel,
				affectedMenu: 1,
				opt0_2: 2,
				offset: 0,
				limit: info.itemCount,
				len_a: info.itemCount,
				opt5: 0,
			}), haveRenderedMenu);
		}
		function haveRenderedMenu(err, data, info){
			console.log('haveRenderedMenu');
			//console.log(data);
			data.items.forEach(function(v){
				var key = DBSt.itemTypeLabels[v.symbol] || v.symbol.toString(16);
				var value = v.label || v.numeric;
				console.log(key+': '+value);
			});
			console.log('');
		}
	});
}
device.onTrackChangeMetadata = function(client){
	console.log('Track change metadata', client.chan, client.currentTrack);
}

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

var dbService;

var udpProxy = require('./udpproxy.js');
udpProxy(50111, device.ipaddr, 111, '127.0.0.1');

var DBSt = require('./dbstruct.js');

function getDBServerPort(port, host, callback){
	var sock = net.connect(port, host);
	var service = "RemoteDBServer";
	var serviceBuf = new Buffer(service.length+5);
	serviceBuf.writeUInt32BE(service.length+1);
	for(var i=0; i<service.length; i++) serviceBuf[i+4] = service.charCodeAt(i);
	sock.write(serviceBuf);
	sock.on('data', function(data){
		console.log(data);
		var port = data.readUInt16BE(0);
		if(port && callback){
			callback(null, port);
			callback = null;
		}
	});
	sock.on('end', function(e){
		if(callback){
			callback(e);
			callback = null;
		}
	});
}

// 1. Boot normally, wait 3 more seconds
// 2. Load track off "SD card" and play it
// 3. become master
// 4. CDJ3 queries us for track information
// 5. CDJ3 queries us for the track data and position and tries to play it in sync

