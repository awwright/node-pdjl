#!/usr/bin/env node
var net = require("net");
var fs = require("fs");
var ifaceConfFile = process.env.PDJL_CONFIG || 'iface.json';
console.log('Config: '+ifaceConfFile);
var ifaceConf = JSON.parse(fs.readFileSync(ifaceConfFile));
var DJMDevice = require('./libdjm.js').DJMDevice;

var device = new DJMDevice;
device.setConfigureCDJ2000NXS();
device.channel = 0x2;
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
	getDBServerSocket(client.chan, function(err, sock){
		console.log('Have DBServer reference...');
			console.log('> Item2002');
			var firstRequestId = sock.issueRequest(new DBSt.Item2002({
				requestId: firstRequestId,
				clientChannel: device.channel,
				affectedMenu: 1,
				opt0_2: 2,
				resourceId: client.currentTrack,
			}), haveFirstRequest);
		function haveFirstRequest(err, data, info){
			console.log(info);
			console.log('> Item3000');
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
			console.log(info);
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
var DBServer = require('./dbserver.js');
net.createServer(DBServer.handleDBServerConnection.bind(null, device)).listen(1051);

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

function getDBServerSocket(chan, callback){
	console.log('Looking up DBServer socket...');
	var remote =  device.devices[chan];
	if(!remote) throw new Error('Unknown device on channel '+chan);
	process.nextTick(function(){
		if(remote.dbServerSocket){
			callback(null, remote.dbServerSocket);
		}else if(remote.dbServerPort){
			console.log('Starting initial connection to '+remote.address+':'+remote.dbServerPort+' ...');
			getDBServerPort(remote.dbServerPort, remote.address, connectDB);
		}else{
			connectDB(1051||remote.dbServerPort, remote.address, function(err, d){
				remote.dbServerSocket = d;
				callback(err, d);
			});
		}
	});
}

function connectDB(port, address, callback){
	console.log('dbServer on '+port);
	//var sock = net.connect(port, address);
	var sock = net.connect(1051, address);
	console.log('> Handshake');
	sock.write(new DBSt.ItemHandshake().toBuffer());
	var init = 0;
	sock.requestId = 1;
	var requests = {};
	var data = new Buffer(0);
	sock.issueRequest = issueRequest;
	function issueRequest(request, cb){
		var rid = request.requestId = sock.requestId++;
		requests[rid] = {};
		requests[rid].done = cb;
		console.log(DBSt.formatBuf(request.toBuffer()));
		sock.write(request.toBuffer());
		return rid;
	}
	sock.on('data', function(newdata){
		console.log('< Response');
		data = Buffer.concat([data, newdata]);
		console.log(DBSt.formatBuf(data));
		for(var message; message = DBSt.parseMessage(data);){
			handleMessage(message);
			data = data.slice(message.length);
			if(!data.length) break;
		}
		
		function handleMessage(){
			console.log('Response class: '+message.constructor.name);
			// Parse message contents
			if(message instanceof DBSt.Item){
				var info = DBSt.parseItem(message, data.slice(0,message.length));
			}else{
				var info = message;
			}
			DBSt.assertParsed(data.slice(0,message.length), info);
			console.log(info);
			console.log('Response type: '+info.constructor.name);
			if(info instanceof DBSt.ItemHandshake){
				console.log('> ItemHello');
				console.log(DBSt.formatBuf(new DBSt.ItemHello(device.channel).toBuffer()));
				sock.write(new DBSt.ItemHello(device.channel).toBuffer());
				return;
			}
			if(info instanceof DBSt.ItemSup){
				dbService = sock;
				callback(null, sock);
				return;
			}
			var req = requests[info.requestId];
			if(!req) throw new Error('Cannot find requestId '+info.requestId.toString(16));
			if(info instanceof DBSt.Item4001){
				// This is the first message in a series, don't fire a response just yet
				req.header = info;
				req.items = [];
				console.log('Have header');
				return;
			}
			if(info instanceof DBSt.Item41){
				// This is an item in a series, wait for the footer element
				req.header = info;
				req.items.push(info);
				console.log('Have item');
				return;
			}
			// Handle footer elements and anything else
			if(req.done){
				console.log('Have message');
				//delete requests[rid];
				req.done(null, req, info);
			}else{
				console.error('Unhandled packet!');
			}
		}
	});
	
}

// 1. Boot normally, wait 3 more seconds
// 2. Load track off "SD card" and play it
// 3. become master
// 4. CDJ3 queries us for track information
// 5. CDJ3 queries us for the track data and position and tries to play it in sync

