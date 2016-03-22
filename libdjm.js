#!/usr/bin/env node
var dgram = require("dgram");
var net = require("net");

var DJMDeviceDefaults = {
	channel: 4,
	macaddr: '00:00:00:00:00:00',
	ipaddr: '10.10.10.10',
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
	beatinfoBPM: 138,
	beatinfoPacketId: 0,
};

module.exports.DJMDevice = DJMDevice;
function DJMDevice(){
	for(var k in DJMDeviceDefaults){
		this[k] = DJMDeviceDefaults[k];
	}
}

function IPToArr(s){
	return s.split('.').map(function(v){ return parseInt(v,10); });
}
function MACToArr(s){
	return s.split(':').map(function(v){ return parseInt(v,16); });
}
Number.prototype.toByteString = function toByteString(n){
	return ('0000'+this.toString(16)).substr(-(n||2));
}

DJMDevice.prototype.connect = function connect() {
	var device = this;;
	var bindIP = null;
	var sock0 = device.sock0 = dgram.createSocket("udp4");
	var sock1 = device.sock1 = dgram.createSocket("udp4");
	var sock2 = device.sock2 = dgram.createSocket("udp4");

	sock0.on("message", device.onMsg0.bind(device));
	sock1.on("message", device.onMsg1.bind(device));
	sock2.on("message", device.onMsg2.bind(device));

	sock0.on("listening", function () {
		var address = sock0.address();
		device.log("server listening " +	address.address + ":" + address.port);
	});
	sock1.on("listening", function () {
		var address = sock1.address();
		device.log("server listening " +	address.address + ":" + address.port);
	});
	sock2.on("listening", function () {
		var address = sock2.address();
		device.log("server listening " +	address.address + ":" + address.port);
	});

	var waiting = 3;
	sock0.bind(50000, bindIP, function onBound0(){
		device.log('bound0', device.ipaddr, device.broadcastIP);
		//sock0.addMembership(device.ipaddr, device.broadcastIP);
		sock0.setBroadcast(true);
		doneBind();
	});
	sock1.bind(50001, bindIP, function onBound1(){
		device.log('bound1', device.ipaddr, device.broadcastIP);
		//sock1.addMembership(device.ipaddr, device.broadcastIP);
		sock1.setBroadcast(true);
		doneBind();
	});
	sock2.bind(50002, bindIP, function onBound2(){
		device.log('bound2', device.ipaddr, device.broadcastIP);
		//sock2.addMembership(device.ipaddr, device.broadcastIP);
		sock2.setBroadcast(true);
		doneBind();
	});
	function doneBind(){
		if(--waiting===0){
			device.boot();
		}
	}
}


DJMDevice.prototype.onMsg0 = function onMsg0(msg, rinfo) {
	var device = this;
	//device.log("50000 server got: " + msg + " from " + rinfo.address + ":" + rinfo.port);
	var type = msg[0x0a];
	var typeStr = ('0'+type.toString(16)).substr(-2);
	var deviceName = msg.toString().substr(0x0b, 16).replace(/\x00/g, '');
	//device.log(rinfo.address + " " + deviceName + ' ' + typeStr);
	if(type==0x01){
		device.log('< '+rinfo.address + ":" + rinfo.port+' 0_x'+typeStr);
		if(device.on0x01) device.on0x01(msg, rinfo);
	}else if(type==0x03){
		device.log('< '+rinfo.address + ":" + rinfo.port+' 0_x'+typeStr);
		if(device.on0x03) device.on0x03(msg, rinfo);
	}else if(type==0x05){
		device.log('< '+rinfo.address + ":" + rinfo.port+' 0_x'+typeStr);
		if(device.on0x05) device.on0x05(msg, rinfo);
	}else if(type==0x04){
		device.log('< '+rinfo.address + ":" + rinfo.port+' 0_x'+typeStr+' Device '+rinfo.address+' is channel '+msg[0x23].toString(16));
		if(msg[0x23]==0x21){
			device.mixerIP = rinfo.address;
		}
		device.sendDeviceAck(rinfo.address);
	}else if(type==0x06){
		var chan = msg[0x24];
		//device.log('< '+rinfo.address + ":" + rinfo.port+' 0_x'+typeStr+' Device is channel '+msg[0x24].toString(16));
		device.devices[chan] = {
			chan: chan,
			alive: new Date,
			address: rinfo.address,
		};
		for(var n in device.devices){
			if(device.devices[n].alive.valueOf() > new Date().valueOf()+6000){
				delete device.devices[n];
				device.log('Lost '+n);
			}
		}
	}else if(type==0x08){
		device.log('< '+rinfo.address + ":" + rinfo.port+' 0_x'+typeStr+': You must change channels!');
	}else{
		device.log('< '+rinfo.address + ":" + rinfo.port+' 0_x'+typeStr+' Unknown type');
	}
}

DJMDevice.prototype.onMsg1 = function onMsg1(msg, rinfo) {
	var device = this;
	//device.log("50001 server got: " + msg + " from " + rinfo.address + ":" + rinfo.port);
	var type = msg[0x0a];
	var typeStr = ('0'+type.toString(16)).substr(-2);
	if(type==0x2a){
		// This packet is supposed to ask us to become master, I think?
		// Or slaved/synced
		var a = msg[0x2b];
		if(a==0x10){
			device.log('< 1_x2a Sync to master');
			device.sync = true;
		}else if(a==0x20){
			device.log('< 1_x2a Free from sync');
			device.sync = false;
		}else if(a==0x01 || a==0x02){
			device.log('< 1_x2a Become master!');
			device.handleNewMaster(device.channel);
			device.send1x26(rinfo.address);
		}else{
			device.log(' 1_x2b Unknown sync assignment???', a);
		}
	}else if(type==0x26){
		device.log('< 1_x26 Acknowledge new master');
		device.handleNewMaster(msg[0x27]);
		device.send1x27(rinfo.address);
	}
}

DJMDevice.prototype.onMsg2 = function onMsg2(msg, rinfo) {
	var device = this;
	var type = msg[0x0a];
	var typeStr = ('0'+type.toString(16)).substr(-2);
	//device.log("50002 " + rinfo.address + ":" + rinfo.port + ' ' + typeStr);
	if(type==0x03){
		// Channels on air
	}else if(type==0x0a){
		device.log('< '+rinfo.address + ":" + rinfo.port+' 2_x'+typeStr);
		var data = {
			channel: msg[0x24],
			sourceid: [msg[0x24],msg[0x25],msg[0x26],msg[0x27]],
			trackid: [msg[0x2e],msg[0x2f],msg[0x30],msg[0x31]],
			playlistno: msg[0x33],
			state: msg[0x7b],
			stateStr: ({2:'Loading', 3:'Playing', 5:'Paused', 6:'Stopped/Cue', 7:'Cue Play', 9:'Seeking'})[msg[0x7b]],
			beat: msg[0xa6],
			totalBeats: (msg[0xa2]<<8) | (msg[0xa3]),
			currentBpm: ((msg[0x92]<<8) | (msg[0x93]))/100,
			master: !!(msg[0x9e]&0x01),
		};
		if(device.on2x0a) device.on2x0a(data);
		var newMaster = msg[0x89]&0x20 || msg[0x9e]&0x01;
		if(!newMaster) return;
		var newMasterChannel = msg[0x21];
		if(newMasterChannel==device.channel) return;
		if(device.master!=newMasterChannel){
			device.log('< 2_x0a New master on ch.'+newMasterChannel.toString(16), msg[0x89].toByteString(), msg[0x9e].toByteString());
			device.handleNewMaster(newMasterChannel);
		}
	}else if(type==0x29){
		device.log('< '+rinfo.address + ":" + rinfo.port+' 2_x'+typeStr+': Mixer status packet', msg[0x27]);
		var data = {
			channel: msg[0x21],
			master: !!(msg[0x27]&0x20),
		}
		if(device.on2x29) device.on2x29(data);
		if(data.master){
			device.handleNewMaster(device.channel);

		}
	}else{
		device.log('< '+rinfo.address + ":" + rinfo.port+' Unknown type 2_x'+typeStr);
	}
}

DJMDevice.prototype.log = function log(){
	console.log.apply(console, arguments);
}

DJMDevice.prototype.handleNewMaster = function handleNewMaster(ch){
	var device = this;
	if(device.master===ch) return;
	var oldMaster = ch;
	device.master = ch;
	if(device.onNewMaster) device.onNewMaster(ch);
}


// 50000 0x0a
DJMDevice.prototype.send0x0a = function send0x0a(){
	var device = this;
	var b = Buffer([
		0x51,0x73,0x70,0x74,0x31,0x57,0x6d,0x4a,0x4f,0x4c,0x0a,0x00,0x43,0x44,0x4a,0x2d,
		0x32,0x30,0x30,0x30,0x6e,0x65,0x78,0x75,0x73,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
		0x01,0x02,0x00,0x25,0x01,
	]);
	device.sock0.send(b, 0, b.length, 50000, device.broadcastIP, function(e){
		device.log('> 0x_0a', device.broadcastIP, arguments);
	});
}

// 50000 0x00
DJMDevice.prototype.send0x00 = function send0x00(i){
	var device = this;
	var m = MACToArr(device.macaddr);
	var b = Buffer([
		0x51, 0x73, 0x70, 0x74, 0x31, 0x57, 0x6d, 0x4a, 0x4f, 0x4c, 0x00, 0x00, 0x43, 0x44, 0x4a, 0x2d,
		0x32, 0x30, 0x30, 0x30, 0x6e, 0x65, 0x78, 0x75, 0x73, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		0x01, 0x02, 0x00, 0x2c, i,    0x01, m[0], m[1], m[2], m[3], m[4], m[5],
	]);
	device.sock0.send(b, 0, b.length, 50000, device.broadcastIP, function(e){
		device.log('> 0_x00', arguments);
	});
}


// 50000 0x02
DJMDevice.prototype.send0x02 = function send0x02(i, target){
	var device = this;
	var m = MACToArr(device.macaddr);
	var n = IPToArr(device.ipaddr);
	var chan = device.channel;
	var x31 = 2; //1=Auto, 2=Manual
	// If byte 0x0b is set to 0x00 instead of 0x01, this packet fails to get any response. Odd.
	var bcst =  target ? 0x01 : 0x00 ;
	var target = target || device.broadcastIP;
	var b = Buffer([
		0x51, 0x73, 0x70, 0x74, 0x31, 0x57, 0x6d, 0x4a, 0x4f, 0x4c, 0x02, bcst, 0x43, 0x44, 0x4a, 0x2d,
		0x32, 0x30, 0x30, 0x30, 0x6e, 0x65, 0x78, 0x75, 0x73, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		0x01, 0x02, 0x00, 0x32, n[0], n[1], n[2], n[3], m[0], m[1], m[2], m[3], m[4], m[5], chan, i,
		0x01, x31,
	]);
	device.sock0.send(b, 0, b.length, 50000, target, function(e){
		device.log('> 0_x02');
	});
}

// 50000 0x04
DJMDevice.prototype.send0x04 = function send0x04(i){
	var device = this;
	var chan = device.channel;
	var b = Buffer([
		0x51, 0x73, 0x70, 0x74, 0x31, 0x57, 0x6d, 0x4a, 0x4f, 0x4c, 0x04, 0x00, 0x43, 0x44, 0x4a, 0x2d,
		0x32, 0x30, 0x30, 0x30, 0x6e, 0x65, 0x78, 0x75, 0x73, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		0x01, 0x02, 0x00, 0x26, chan, i
	]);
	device.sock0.send(b, 0, b.length, 50000, device.broadcastIP, function(e){
		device.log('> 0_x04');
	});
}

// Starting with this packet, the DJM responds with 50000 0x05
// Packet identical to 0x04 except for bytes 0x0b, 0x21, 0x24, and device string


// 50000 0x06
// The CDJ goes into regular discovery mode following this:
DJMDevice.prototype.send0x06 = function send0x06(){
	var device = this;
	var chan = device.channel;
	var m = MACToArr(device.macaddr);
	var n = IPToArr(device.ipaddr);
	var ndev = Object.keys(device.devices).length;
	var x25 = 1
	var b = Buffer([
		0x51, 0x73, 0x70, 0x74, 0x31, 0x57, 0x6d, 0x4a, 0x4f, 0x4c, 0x06, 0x00, 0x43, 0x44, 0x4a, 0x2d,
		0x32, 0x30, 0x30, 0x30, 0x6e, 0x65, 0x78, 0x75, 0x73, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		0x01, 0x02, 0x00, 0x36, chan, x25,  m[0], m[1], m[2], m[3], m[4], m[5], n[0], n[1], n[2], n[3],
		ndev, 0x00, 0x00, 0x00, 0x01, 0x00
	]);
	device.sock0.send(b, 0, b.length, 50000, device.broadcastIP, function(e){
		device.log('> 0_x06');
	});
}

// 0=Start, 1=Stop, 2=none
DJMDevice.prototype.send1x02 = function send1x02(c){
	var device = this;
	var chan = device.channel;
	var b = Buffer([
		0x51, 0x73, 0x70, 0x74, 0x31, 0x57, 0x6d, 0x4a, 0x4f, 0x4c, 0x02, 0x44, 0x4a, 0x4d, 0x2d, 0x32,
		0x30, 0x30, 0x30, 0x6e, 0x65, 0x78, 0x75, 0x73, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01,
		0x00, chan, 0x00, 0x04, c[0], c[1], c[2], c[3],
	]);
	device.sock1.send(b, 0, b.length, 50001, device.broadcastIP, function(e){
		device.log('> 1_x02');
	});
}

DJMDevice.prototype.emitBeatinfo = function emitBeatinfo(){
	var device = this;
	for(var n in device.devices){
		if(n==device.channel) continue;
		++device.beatinfoPacketId;
		device.send2x0a(device.devices[n].address, device.beatinfoPacketId, device.beatinfoBeat);
	}
}

DJMDevice.prototype.send2x0a = function send2x0a(target, pid, beat){
	var device = this;
	var chan = device.channel;
	var br = 256-(beat%256);
	var b4 = (beat%4)+1;
	var d = [(beat>>8)&0xff, (beat>>0)&0xff];
	var isMaster = (device.master==device.channel);
	var e = 0x8c | (isMaster?0x20:0x00) | (device.sync?0x10:0x00);
	var x9e = isMaster ? 0x02 : 0x00 ;
	var t = [0x00, 0x10, 0x00, 0x00]; // Track tempo = 100%
	var c = [device.beatinfoBPM>>8&0xff, device.beatinfoBPM&0xff];
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
		0x00, 0x00, c[0], c[1], 0x7f, 0xff, 0xff, 0xff, t[0], t[1], t[2], t[3], 0x00, 0x01, x9e,  0xff,
		0xff, 0xff, d[0], d[1], 0x00, br,   b4,   0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		t[0], t[1], t[2], t[3], t[0], t[1], t[2], t[3], p[0], p[1], p[2], p[3], 0x0f, 0x00, 0x00, 0x00,
		0x00, 0x00, 0x00, 0x00
	]);
	device.sock2.send(b, 0, b.length, 50002, target, function(e){
		//device.log('> 2_x0a', target, pid, beat);
	});
}

DJMDevice.prototype.advertiseNewMaster = function advertiseNewMaster(){
	for(var n in device.devices){
		device.send1x26(device.devices[n].address);
	}
	// TODO if no 1_x27 packet is received from each device, re-send
}

DJMDevice.prototype.send1x26 = function send1x26(ip){
	// 50001 0x26
	var device = this;
	var chan = device.channel;
	var b = Buffer([
		0x51, 0x73, 0x70, 0x74, 0x31, 0x57, 0x6d, 0x4a, 0x4f, 0x4c, 0x26, 0x72, 0x65, 0x6b, 0x6f, 0x72,
		0x64, 0x62, 0x6f, 0x78, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01,
		0x00, chan, 0x00, 0x04, 0x00, 0x00, 0x00, chan,
	]);
	device.sock1.send(b, 0, b.length, 50001, ip, function(e){
		device.log('> 1_x26', arguments);
	});
}


DJMDevice.prototype.send1x27 = function send1x27(ip){
	// 50001 0x27
	var device = this;
	var chan = device.channel;
	var b = Buffer([
		0x51, 0x73, 0x70, 0x74, 0x31, 0x57, 0x6d, 0x4a, 0x4f, 0x4c, 0x27, 0x43, 0x44, 0x4a, 0x2d, 0x32,
		0x30, 0x30, 0x30, 0x6e, 0x65, 0x78, 0x75, 0x73, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01,
		0x00, chan, 0x00, 0x08, 0x00, 0x00, 0x00, chan, 0x00, 0x00, 0x00, 0x01,
	]);
	device.sock1.send(b, 0, b.length, 50001, ip, function(e){
		device.log('> 1_x27', arguments);
	});
}

DJMDevice.prototype.sendDeviceAck = function sendDeviceAck(ip){
	// 50000 0x05
	var device = this;
	var c = device.channel;
	var b = Buffer([
		0x51, 0x73, 0x70, 0x74, 0x31, 0x57, 0x6d, 0x4a, 0x4f, 0x4c, 0x05, 0x00, 0x44, 0x4a, 0x4d, 0x2d,
		0x32, 0x30, 0x30, 0x30, 0x6e, 0x65, 0x78, 0x75, 0x73, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		0x01, 0x02, 0x00, 0x26, c,    0x01,
	]);
	device.sock0.send(b, 0, b.length, 50000, ip, function(e){
		device.log('> 0_x05');
	});
}

DJMDevice.prototype.doBootup = function doBootup(){
	var device = this;
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
			device.send0x00(seq);
			timeout = setTimeout(sendNext, 300);
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
			device.send0x02(seq, mixerIp);
			timeout = setTimeout(sendNext, 300);
			seq++;
		}
		sendNext();
	}
	function step0x04(){
		var seq = 1;
		var timeout;
		device.on0x05 = function(msg, rinfo){
			clearTimeout(timeout);
			device.send0x06();
			device.doDiscoverable();
		};
		function sendNext(){
			if(seq>3){
				clearTimeout(timeout);
				device.log('Weare the first device on the network?');
				device.doDiscoverable();
				return;
			}
			device.send0x04(seq);
			timeout = setTimeout(sendNext, 300);
			seq++;
		}
		sendNext();
	}
}
DJMDevice.prototype.doDiscoverable = function doDiscoverable(){
	var device = this;
	setInterval(function(){
		device.send0x06();
	}, 2000);
	setInterval(function(){
		device.emitBeatinfo();
		++device.beatinfoBeat;
	}, parseInt(60000/device.beatinfoBPM));
}

DJMDevice.prototype.boot = function boot(){
	var wait = 300;
	setTimeout(this.send0x0a.bind(this), 0*wait);
	setTimeout(this.send0x0a.bind(this), 1*wait);
	setTimeout(this.send0x0a.bind(this), 2*wait);
	setTimeout(this.doBootup.bind(this), 3*wait);
}
