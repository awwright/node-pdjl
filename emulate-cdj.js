#!/usr/bin/env node
var dgram = require("dgram");

var ifaceConf = require('./iface.json');

var device = {
	channel: 4,
	macaddr: ifaceConf.mac.split(':').map(function(v){return parseInt(v,16);}),
	ipaddr: ifaceConf.ip,
	master: null,
	sync: false,
	broadcastIP: '192.168.0.255',
	mixerIP: '192.168.0.90',
	//broadcastIP: '169.254.255.255',
	//mixerIP: '169.254.101.168',
	devices: {},
	modePlayer: false,
	modeMixer: false,
	modeLink: true,
	beatinfoBeat: 0,
	beatinfoPacketId: 0,
};

console.log('MAC: '+device.macaddr);
console.log('IP: '+device.ipaddr);

function ipToArr(s){
	return s.split('.').map(function(v){ return parseInt(v,10); });
}
Number.prototype.toByteString = function toByteString(n){
	return ('0000'+this.toString(16)).substr(-(n||2));
}

var sock0 = dgram.createSocket("udp4");
var sock1 = dgram.createSocket("udp4");
var sock2 = dgram.createSocket("udp4");

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

sock0.on("message", function (msg, rinfo) {
	//console.log("50000 server got: " + msg + " from " + rinfo.address + ":" + rinfo.port);
	var type = msg[0x0a];
	var typeStr = ('0'+type.toString(16)).substr(-2);
	var deviceName = msg.toString().substr(0x0b, 16).replace(/\x00/g, '');
	//console.log(rinfo.address + " " + deviceName + ' ' + typeStr);
	if(type==0x01){
		console.log('< '+rinfo.address + ":" + rinfo.port+' 0_x'+typeStr);
		if(device.on0x01) device.on0x01(msg, rinfo);
	}else if(type==0x03){
		console.log('< '+rinfo.address + ":" + rinfo.port+' 0_x'+typeStr);
		if(device.on0x03) device.on0x03(msg, rinfo);
	}else if(type==0x05){
		console.log('< '+rinfo.address + ":" + rinfo.port+' 0_x'+typeStr);
		if(device.on0x05) device.on0x05(msg, rinfo);
	}else if(type==0x04){
		console.log('< '+rinfo.address + ":" + rinfo.port+' 0_x'+typeStr+' Device '+rinfo.address+' is channel '+msg[0x23].toString(16));
		if(msg[0x23]==0x21){
			device.mixerIP = rinfo.address;
		}
		sendDeviceAck(rinfo.address);
	}else if(type==0x06){
		var chan = msg[0x24];
		//console.log('< '+rinfo.address + ":" + rinfo.port+' 0_x'+typeStr+' Device is channel '+msg[0x24].toString(16));
		device.devices[chan] = {
			chan: chan,
			alive: new Date,
			address: rinfo.address,
		};
		for(var n in device.devices){
			if(device.devices[n].alive.valueOf() > new Date().valueOf()+6000){
				delete device.devices[n];
				console.log('Lost '+n);
			}
		}
	}else if(type==0x08){
		console.log('< '+rinfo.address + ":" + rinfo.port+' 0_x'+typeStr+': Change channels!');
	}else{
		console.log('< '+rinfo.address + ":" + rinfo.port+' 0_x'+typeStr+' Unknown type');
	}
});
sock1.on("message", function (msg, rinfo) {
	//console.log("50001 server got: " + msg + " from " + rinfo.address + ":" + rinfo.port);
	var type = msg[0x0a];
	var typeStr = ('0'+type.toString(16)).substr(-2);
	if(type==0x2a){
		// This packet is supposed to ask us to become master, I think?
		// Or slaved/synced
		var a = msg[0x2b];
		if(a==0x10){
			console.log('< 1_x2a Sync to master');
			device.sync = true;
		}else if(a==0x20){
			console.log('< 1_x2a Free from sync');
			device.sync = false;
		}else if(a==0x01 || a==0x02){
			console.log('< 1_x2a Become master!');
			device.master = device.channel;
			send1x26(rinfo.address);
		}else{
			console.log(' 1_x2b Unknown sync assignment???', a);
		}
	}else if(type==0x26){
		console.log('< 1_x26 Acknowledge new master');
		send1x27(rinfo.address);
	}
});
sock2.on("message", function (msg, rinfo) {
	var type = msg[0x0a];
	var typeStr = ('0'+type.toString(16)).substr(-2);
	//console.log("50002 " + rinfo.address + ":" + rinfo.port + ' ' + typeStr);
	if(type==0x0a){
		//console.log('< '+rinfo.address + ":" + rinfo.port+' 2_x'+typeStr);
		var newMaster = msg[0x89]&0x20 || msg[0x9e]&0x01;
		var channel = msg[0x21];
		if(channel==device.channel) return;
		if(newMaster && device.master!=channel){
			console.log('< 2_x0a New master on ch.'+channel.toString(16), msg[0x89].toByteString(), msg[0x9e].toByteString());
			device.master = channel;
		}
	}else if(type==0x29){
		//console.log('< '+rinfo.address + ":" + rinfo.port+' 2_x'+typeStr+': Channels on-air');
	}else{
		console.log('< '+rinfo.address + ":" + rinfo.port+' Unknown type 2_x'+typeStr);
	}
});

// 50000 0x0a
function send0x0a(){
	var b = Buffer([
		0x51,0x73,0x70,0x74,0x31,0x57,0x6d,0x4a,0x4f,0x4c,0x0a,0x00,0x43,0x44,0x4a,0x2d,
		0x32,0x30,0x30,0x30,0x6e,0x65,0x78,0x75,0x73,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
		0x01,0x02,0x00,0x25,0x01,
	]);
	sock0.send(b, 0, b.length, 50000, device.broadcastIP, function(e){
		console.log('> 0x_0a', arguments);
	});
}

// 50000 0x00
function send0x00(i){
	var m = device.macaddr;
	var b = Buffer([
		0x51, 0x73, 0x70, 0x74, 0x31, 0x57, 0x6d, 0x4a, 0x4f, 0x4c, 0x00, 0x00, 0x43, 0x44, 0x4a, 0x2d,
		0x32, 0x30, 0x30, 0x30, 0x6e, 0x65, 0x78, 0x75, 0x73, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		0x01, 0x02, 0x00, 0x2c, i,    0x01, m[0], m[1], m[2], m[3], m[4], m[5],
	]);
	sock0.send(b, 0, b.length, 50000, device.broadcastIP, function(e){
		console.log('> 0_x00', arguments);
	});
}


// 50000 0x02
function send0x02(i, target){
	var m = device.macaddr;
	var n = ipToArr(device.ipaddr);
	var chan = device.channel;
	// If byte 0x0b is set to 0x00 instead of 0x01, this packet fails to get any response. Odd.
	var bcst =  target ? 0x01 : 0x00 ;
	var target = target || device.broadcastIP;
	var b = Buffer([
		0x51, 0x73, 0x70, 0x74, 0x31, 0x57, 0x6d, 0x4a, 0x4f, 0x4c, 0x02, bcst, 0x43, 0x44, 0x4a, 0x2d,
		0x32, 0x30, 0x30, 0x30, 0x6e, 0x65, 0x78, 0x75, 0x73, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		0x01, 0x02, 0x00, 0x32, n[0], n[1], n[2], n[3], m[0], m[1], m[2], m[3], m[4], m[5], chan, i,
		0x01, 0x01,
	]);
	sock0.send(b, 0, b.length, 50000, target, function(e){
		console.log('> 0_x02');
	});
}


// 50000 0x04
function send0x04(){
	var chan = device.channel;
	var b = Buffer([
		0x51, 0x73, 0x70, 0x74, 0x31, 0x57, 0x6d, 0x4a, 0x4f, 0x4c, 0x04, 0x00, 0x43, 0x44, 0x4a, 0x2d,
		0x32, 0x30, 0x30, 0x30, 0x6e, 0x65, 0x78, 0x75, 0x73, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		0x01, 0x02, 0x00, 0x26, chan, 0x01
	]);
	sock0.send(b, 0, b.length, 50000, device.broadcastIP, function(e){
		console.log('> 0_x04');
	});
}

// Starting with this packet, the DJM responds with 50000 0x05
// Packet identical to 0x04 except for bytes 0x0b, 0x21, 0x24, and device string


// 50000 0x06
// The CDJ goes into regular discovery mode following this:
function send0x06(pid){
	var chan = device.channel;
	var m = device.macaddr;
	var n = ipToArr(device.ipaddr);
	var ndev = Object.keys(device.devices).length;
	pid = pid || 3; // PacketId: Starts at one, counts up to 3
	var b = Buffer([
		0x51, 0x73, 0x70, 0x74, 0x31, 0x57, 0x6d, 0x4a, 0x4f, 0x4c, 0x06, 0x00, 0x43, 0x44, 0x4a, 0x2d,
		0x32, 0x30, 0x30, 0x30, 0x6e, 0x65, 0x78, 0x75, 0x73, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		0x01, 0x02, 0x00, 0x36, chan, pid,  m[0], m[1], m[2], m[3], m[4], m[5], n[0], n[1], n[2], n[3],
		ndev, 0x00, 0x00, 0x00, 0x01, 0x00
	]);
	sock0.send(b, 0, b.length, 50000, device.broadcastIP, function(e){
		console.log('> 0_x06');
	});
}

function emitBeatinfo(){
	for(var n in device.devices){
		if(n==device.channel) continue;
		++device.beatinfoPacketId;
		send2x0a(device.devices[n].address, device.beatinfoPacketId, device.beatinfoBeat);
	}
}

function send2x0a(target, pid, beat){
	var chan = device.channel;
	var br = 256-(beat%256);
	var b4 = (beat%4)+1;
	var d = [(beat>>8)&0xff, (beat>>0)&0xff];
	var isMaster = (device.master==device.channel);
	var e = 0x8c | (isMaster?0x20:0x00) | (device.sync?0x10:0x00);
	var x9e = isMaster ? 0x02 : 0x00 ;
	var t = [0x00, 0x10, 0x00, 0x00]; // Track tempo = 100%
	var p = [(pid>>24)&0xff, (pid>>16)&0xff, (pid>>8)&0xff, pid&0xff]; // Packet id
	var b = Buffer([
		0x51, 0x73, 0x70, 0x74, 0x31, 0x57, 0x6d, 0x4a, 0x4f, 0x4c, 0x0a, 0x43, 0x44, 0x4a, 0x2d, 0x32,
		0x30, 0x30, 0x30, 0x6e, 0x65, 0x78, 0x75, 0x73, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01,
		0x03, chan, 0x00, 0xb0, chan, 0x00, 0x00, 0x00, 0x03, 0x01, 0x05, 0x00, 0x00, 0x00, 0x00, 0x01,
		0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x1e, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x08, 0x00, 0x00, 0x08, 0x00, 0x2e, 0x93, 0x03, 0x00,
		0xf4, 0x72, 0x00, 0x00, 0xb3, 0x24, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x22, 0x04, 0x04, 0x00, 0x00, 0x00, 0x04,
		0x00, 0x00, 0x00, 0x04, 0x00, 0x01, 0x04, 0x00, 0x00, 0x00, 0x00, 0x06, 0x31, 0x2e, 0x32, 0x32,
		0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, e,    0x0d, 0x7c, t[0], t[1], t[2], t[3],
		0x00, 0x00, 0x32, 0x04, 0x7f, 0xff, 0xff, 0xff, t[0], t[1], t[2], t[3], 0x00, 0x01, x9e,  0xff,
		0xff, 0xff, d[0], d[1], 0x00, br,   b4,   0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		t[0], t[1], t[2], t[3], t[0], t[1], t[2], t[3], p[0], p[1], p[2], p[3], 0x0f, 0x00, 0x00, 0x00,
		0x00, 0x00, 0x00, 0x00
	]);
	sock2.send(b, 0, b.length, 50002, target, function(e){
		//console.log('> 2_x0a');
	});
}

function advertiseNewMaster(){
	for(var n in device.devices){
		send1x26(device.devices[n].address);
	}
	// TODO if no 1_x27 packet is received from each device, re-send
}

function send1x26(ip){
	// 50001 0x26
	var chan = device.channel;
	var b = Buffer([
		0x51, 0x73, 0x70, 0x74, 0x31, 0x57, 0x6d, 0x4a, 0x4f, 0x4c, 0x26, 0x72, 0x65, 0x6b, 0x6f, 0x72,
		0x64, 0x62, 0x6f, 0x78, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01,
		0x00, chan, 0x00, 0x04, 0x00, 0x00, 0x00, chan,
	]);
	sock1.send(b, 0, b.length, 50001, ip, function(e){
		console.log('> 1_x26', arguments);
	});
}


function send1x27(ip){
	// 50001 0x27
	var chan = device.channel;
	var b = Buffer([
		0x51, 0x73, 0x70, 0x74, 0x31, 0x57, 0x6d, 0x4a, 0x4f, 0x4c, 0x27, 0x43, 0x44, 0x4a, 0x2d, 0x32,
		0x30, 0x30, 0x30, 0x6e, 0x65, 0x78, 0x75, 0x73, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01,
		0x00, chan, 0x00, 0x08, 0x00, 0x00, 0x00, chan, 0x00, 0x00, 0x00, 0x01,
	]);
	sock1.send(b, 0, b.length, 50001, ip, function(e){
		console.log('> 1_x27', arguments);
	});
}

function sendDeviceAck(ip){
	// 50000 0x05
	var c = device.channel;
	var b = Buffer([
		0x51, 0x73, 0x70, 0x74, 0x31, 0x57, 0x6d, 0x4a, 0x4f, 0x4c, 0x05, 0x00, 0x44, 0x4a, 0x4d, 0x2d,
		0x32, 0x30, 0x30, 0x30, 0x6e, 0x65, 0x78, 0x75, 0x73, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		0x01, 0x02, 0x00, 0x26, c,    0x01,
	]);
	sock0.send(b, 0, b.length, 50000, ip, function(e){
		console.log('> 0_x05');
	});
}

sock0.bind(50000, function onBound0(){
	console.log('bound0');
	sock0.setBroadcast(true);
	var wait = 400;
	setTimeout(send0x0a, 1*wait);
	setTimeout(send0x0a, 2*wait);
	setTimeout(send0x0a, 3*wait);
	setTimeout(doBootup, 4*wait);
});
sock1.bind(50001, function onBound1(){
	console.log('bound1');
	sock1.setBroadcast(true);
});
sock2.bind(50002, function onBound2(){
	console.log('bound2');
	sock2.setBroadcast(true);
});


function doBootup(){
	step0x00();
	function step0x00(){
		var seq = 1;
		var timeout;
		device.on0x01 = function(msg, rinfo){
			clearTimeout(timeout);
			device.channel = 0; // Reset the channel to detect what we're plugged into
			step0x02(rinfo.address);
		};
		function sendNext(){
			if(seq>3){
				clearTimeout(timeout);
				step0x02();
				return;
			}
			send0x00(seq);
			timeout = setTimeout(sendNext, 1000);
			seq++;
		}
		sendNext();
	}
	function step0x02(mixerIp){
		var seq = 1;
		var timeout;
		device.on0x03 = function(msg, rinfo){
			clearTimeout(timeout);
			device.channel = msg[0x24];
			step0x04();
		};
		function sendNext(){
			if(seq>3){
				clearTimeout(timeout);
				step0x04();
				return;
			}
			send0x02(seq, mixerIp);
			timeout = setTimeout(sendNext, 1000);
			seq++;
		}
		sendNext();
	}
	function step0x04(){
		var seq = 1;
		var timeout;
		device.on0x05 = function(msg, rinfo){
			clearTimeout(timeout);
			doDiscoverable();
		};
		function sendNext(){
			if(seq>3){
				clearTimeout(timeout);
				console.log('Weare the first device on the network?');
				return;
			}
			send0x04(seq);
			timeout = setTimeout(sendNext, 1000);
			seq++;
		}
		sendNext();
	}
}
function doDiscoverable(){
	setInterval(send0x06, 5000);
	setInterval(function(){
		emitBeatinfo();
		++device.beatinfoBeat;
	}, parseInt(60000/138));
}
