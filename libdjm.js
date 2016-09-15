#!/usr/bin/env node
var dgram = require("dgram");
var net = require("net");

var DBSt = module.exports.DBSt = require('./dbstruct.js');
var DBServer = require('./dbserver.js');
var udpProxy = require('./udpproxy.js');

module.exports.TrackReference = TrackReference;
function TrackReference(network, channel, media, ana, id){
	this.network = network;
	this.channel = channel;
	this.media = media;
	this.analysis = ana;
	this.id = id;
};
TrackReference.prototype.toString = function toString(){
	// remove circular references
	return [this.channel,this.media,this.analysis,this.id].map(function(v){return v.toString(16)}).join(',');
};
TrackReference.prototype.toJSON = function toJSON(){
	// remove circular references
	return {
		channel: this.channel,
		media: this.media,
		analysis: this.analysis,
		id: this.id,
	};
};
TrackReference.prototype.compare = function compare(other){
	if(typeof other!='object' || !(other instanceof TrackReference)) return;
	return (
		this.network==other.network &&
		this.channel==other.channel &&
		this.media==other.media &&
		this.analysis==other.analysis &&
		this.id == other.id
	);
};
TrackReference.prototype.getMetadata = function requestMetadata(cb){
	var self = this;
	self.network.sendDBSQuery(self.channel, new DBSt.Item2002({
		clientChannel: self.network.channel, // send channel of local device
		affectedMenu: 1,
		sourceMedia: self.media,
		sourceAnalyzed: 1,
		resourceId: self.id,
	}), haveFirstRequest);
	function haveFirstRequest(err, data, info){
		if(err){
			console.error('Error', err.toString());
			return;
		}
		self.network.sendDBSQuery(self.channel, new DBSt.Item30({
			clientChannel: self.network.channel,
			affectedMenu: 1,
			sourceMedia: 2,
			sourceAnalyzed: 1,
			offset: 0,
			limit: info.itemCount,
			len_a: info.itemCount,
			opt5: 0,
		}), haveRenderedMenu);
	}
	function haveRenderedMenu(err, data, info){
		if(err){
			console.error('Error', err.toString());
			return;
		}
		self.network.haveTrackMetadata2102(self, info);
		cb(null, trackData);
	}
};
TrackReference.prototype.getBeatgrid = function getBeatgrid(cb){
	var self = this;
	self.network.sendDBSQuery(self.channel, new DBSt.Item2204({
		clientChannel: self.network.channel, // send channel of local device
		affectedMenu: 8 ,
		sourceMedia: self.media,
		sourceAnalyzed: 1,
		resourceId: self.id,
	}), haveFirstRequest);
	function haveFirstRequest(err, data, info){
		if(err){
			console.error('Error', err.toString());
			return void cb(err);
		}
		if(!(info instanceof DBSt.Item4602)){
			return void cb(new Error('Unexpected response'));
		}
		var track = self.network.haveBeatgrid(self, info);
		cb(null, track, info);
	}
};



module.exports.DJMDevice = DJMDevice;
function DJMDevice(){
	for(var k in DJMDevice.Defaults){
		this[k] = DJMDevice.Defaults[k];
	}
}

DJMDevice.Defaults = {
	// Generic configuration information
	channel: 4,
	macaddr: '00:00:00:00:00:00',
	ipaddr: '10.10.10.10',
	master: null,
	sync: false,
	broadcastIP: '192.168.0.255',
	mixerIP: '192.168.0.90',
	portmapperProxyTargetPort: 111,
	//broadcastIP: '169.254.255.255',
	//mixerIP: '169.254.101.168',
	devices: {}, // Keeps state about devices currently on network
	tracks: {},
	// Device capability information
	modePlayer: false,
	modeMixer: false,
	modeLink: true,
	beatinfoBeat: 0,
	beatinfoBPM: 120,
	beatinfoPacketId: 0,
	firmwareVersion: '1.25', // Four bytes exactly
	deviceTypeName: 'CDJ-2000nexus', // 20 bytes max, 7-bit ASCII
	deviceType8: 0x02, // 1=DJM, 2=CDJ, 3=rekordbox
	hardwareMode: 'cdj-2000nxs', // What kind of device to emulate
	negotiationMode: 'cdj', // which method for finding an unused channel to use, either "cdj" or "rekordbox"
	useBoot00a: true,
	useBoot004: true,
	useBeat128: false,
	useBeat20a: false,
	useBeat229: false,
	useDbserver: false,
	useDbclient: false,
	usePortmapper: false,
	// Device configuration information
	hostname: 'localhost',
	// Device state information
	hasCD: false,
	hasSD: false,
	hasUSB: false,
	haveBeatinfo: false, // Is the current track beat-analyzed?
	cdjMediaSource: 'none', // The source of the currently playing track {none,cd,sd,usb,link}
	cdjMediaState: 'none', // {none,loading,play,pause,cue,cueplay,seek}
	// Internal state management
	haveSent216: false,
	connected: false,
	// Callbacks
	onListening: null, // when the device has made itself aware to other devices and is ready to send messages
	onDeviceChange: null, // if a device appears or dissappears on the network
	onTrackChangeDetect: null, // if the currently playing track on a device changes
	onTrackChangeMetadata: null, // when we receive the metadata of the newly playing track
	onTrackChangeBeatgrid: null, // when we receive the beat grid for the newly playing track
	on1x28: null, // Packet every new beat from a CDJ
	on2x0a: null, // Status updates on tempo and beat from CDJ
};

function IPToArr(s){
	return s.split('.').map(function(v){ return parseInt(v,10); });
}
function MACToArr(s){
	return s.split(':').map(function(v){ return parseInt(v,16); });
}
Number.prototype.toByteString = function toByteString(n){
	return ('0000'+this.toString(16)).substr(-(n||2));
}

DJMDevice.magic = [0x51, 0x73, 0x70, 0x74, 0x31, 0x57, 0x6d, 0x4a, 0x4f, 0x4c];

DJMDevice.playStateMap = {
	2: 'Loading',
	3: 'Playing',
	5: 'Paused',
	6: 'Cue Stop',
	7: 'Cue Play',
	8: 'Cue Scratch',
	9: 'Seeking',
};

DJMDevice.analyzedStatus = {
	1: 'Analyzed',
	2: 'Unanalyzed',
	5: 'CD',
};

DJMDevice.mediaSourceMap = {
	1: 'CD',
	2: 'SD',
	3: 'USB',
	4: 'rekordbox',
};



DJMDevice.prototype.setConfigurePassive = function setConfigurePassive() {
	// In passive mode, we listen to the network for incoming packets without emiting anything
	// Based on the packets, we emit callbacks and keep track of the network state
	var device = this;
	device.hardwareMode = 'passive';
	device.usePDJL50000 = false;
	device.usePDJL50001 = false;
	device.usePDJL50002 = false;
	device.useBoot00a = false;
	device.useBoot004 = false;
	device.useBeat128 = false;
	device.useBeat20a = false;
	device.useBeat229 = false;
	device.useDbserver = false;
	device.useDbclient = false;
	device.usePortmapper = false;
	device.modePlayer = false;
	device.modeMixer = false;
	device.hasCD = false;
	device.hasSD = false;
	device.hasUSB = false;
	// This does have some sort of file it can offer over the network
	// But need to create an option to expose it/figure out how it's exposed
}
DJMDevice.prototype.setConfigureDJM2000NXS = function setConfigureDJM2000NXS() {
	var device = this;
	device.hardwareMode = 'djm-2000nxs';
	device.negotiationMode = 'cdj';
	//device.firmwareVersion = '    ';
	device.deviceTypeName = 'DJM-2000nexus';
	device.deviceType8 = 1;
	device.usePDJL50000 = true;
	device.usePDJL50001 = true;
	device.usePDJL50002 = true; // check these
	device.useBoot00a = true;
	device.useBoot004 = true;
	device.useBeat128 = false;
	device.useBeat20a = false;
	device.useBeat229 = false; // check this
	device.useDbserver = false;
	device.useDbclient = false;
	device.usePortmapper = false;
	device.modePlayer = false;
	device.modeMixer = true;
	device.hasCD = false;
	device.hasSD = false;
	device.hasUSB = false;
	// This does have some sort of file it can offer over the network
	// But need to create an option to expose it/figure out how it's exposed
}
DJMDevice.prototype.setConfigureCDJ2000NXS = function configureCDJ2000NXS() {
	var device = this;
	device.hardwareMode = 'cdj-2000nxs';
	device.negotiationMode = 'cdj';
	device.firmwareVersion = '1.25';
	device.deviceTypeName = 'CDJ-2000nexus';
	device.deviceType8 = 2;
	device.usePDJL50000 = true;
	device.usePDJL50001 = true;
	device.usePDJL50002 = true;
	device.useBoot00a = true;
	device.useBoot004 = true;
	device.useBeat128 = true;
	device.useBeat20a = true;
	device.useBeat229 = false;
	device.useDbserver = true;
	device.useDbclient = true;
	device.usePortmapper = false;
	device.modePlayer = true;
	device.modeMixer = false;
	device.hasCD = false;
	device.hasSD = false;
	device.hasUSB = false;
}
DJMDevice.prototype.setConfigureRekordbox = function configureRekordbox() {
	var device = this;
	device.hardwareMode = 'rekordbox';
	device.negotiationMode = 'rekordbox';
	device.deviceTypeName = 'rekordbox';
	device.deviceType8 = 3;
	device.usePDJL50000 = true;
	device.usePDJL50001 = true;
	device.usePDJL50002 = true; // check these
	device.useBoot00a = false;
	device.useBoot004 = false;
	device.useBeat128 = false;
	device.useBeat20a = false;
	device.useBeat229 = true;
	device.useDbserver = true;
	device.useDbclient = false;
	device.usePortmapper = true;
	device.modePlayer = false;
	device.modeMixer = false;
	device.hasCD = false;
	device.hasSD = false;
	device.hasUSB = false;
}
DJMDevice.prototype.mountSD = function mountSD() {
	var device = this;
	device.hasSD = true;
}
DJMDevice.prototype.mountUSB = function mountUSB() {
	var device = this;
	device.hasUSB = true;
}

DJMDevice.prototype.dumpPackets = function dumpPackets(filename){
	this.pcapStream = require('fs').createWriteStream(filename);
	// And write the standard header first
	this.pcapStream.write(new Buffer('a1b2c3d4000200040000000000000000000fffff00000001','hex'));
}

// Creates network servers and all the other stuff necessary
DJMDevice.prototype.connect = function connect() {
	var device = this;
	var bindIP = null;
	var waiting = 0;

	function listenUDP(addr, port, fn){
		var sock = dgram.createSocket("udp4");
		sock.on("message", function(v, w){
			//console.log(v);
			fn(v, w);
		});
		sock.on("listening", function () {
			var address = sock.address();
			device.log("server listening " +	address.address + ":" + address.port);
		});
		sock.bind(port, addr, function onBound(){
			device.log('bound');
			sock.setBroadcast(true);
			doneBind();
		});
		waiting++;
		return sock;
	}

	if(device.usePDJL50000){
		device.sock0 = listenUDP(device.ipaddr, 50000, device.onMsg0.bind(device));
		device.sock0b = listenUDP(device.broadcastIP, 50000, device.onMsg0.bind(device));
	}
	if(device.usePDJL50001){
		device.sock1 = listenUDP(device.ipaddr, 50001, device.onMsg1.bind(device));
		device.sock1b = listenUDP(device.broadcastIP, 50001, device.onMsg1.bind(device));
	}
	if(device.usePDJL50002){
		device.sock2 = listenUDP(device.ipaddr, 50002, device.onMsg2.bind(device));
		device.sock2b = listenUDP(device.broadcastIP, 50002, device.onMsg2.bind(device));
	}
	if(device.useTZSPServer){
		device.tzspd = listenUDP('0.0.0.0', 37008, device.onTZSPPacket.bind(device));
	}
	if(device.useTZSPClient){
		device.startTZSPClient(device.tzspServer);
	}

	if(device.useDbserver){
		waiting++;
		this.sockDbServer = net.createServer();
		this.sockDbServer.on('listening', doneBind);
		this.sockDbServer.on('connection', DBServer.handleDBServerConnection.bind(null, device));
		this.sockDbServer.listen(1051);
	}

	if(device.usePortmapper){
		udpProxy(50111, device.ipaddr, device.portmapperProxyTargetPort, '127.0.0.1');
	}

	function doneBind(){
		if(--waiting===0){
			device.log('Starting boot');
			if(typeof device.onConnectInit=='function') device.onConnectInit();
			if(device.usePDJL50000) device.boot();
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
		if(!rinfo.dst && device.usePDJL50000) device.sendDeviceAck(rinfo.address);
	}else if(type==0x06){
		var emitDeviceChange = false;
		var chan = msg[0x24];
		for(var modelName=''; msg[0x0c+modelName.length]; ) modelName += String.fromCharCode(msg[0x0c+modelName.length]);
		//device.log('< '+rinfo.address + ":" + rinfo.port+' 0_x'+typeStr+' Device is channel '+msg[0x24].toString(16));
		if(!device.devices[chan]) emitDeviceChange=true;
		var client = device.devices[chan] = device.devices[chan] || {};
		client.channel = chan;
		client.modelName = modelName;
		client.alive = new Date;
		client.address = rinfo.address;
		for(var n in device.devices){
			if(new Date().valueOf() > device.devices[n].alive.valueOf()+6000){
				delete device.devices[n];
				device.log('Lost x'+n.toString(16));
				emitDeviceChange = true;
			}
		}
		if(emitDeviceChange && device.onDeviceChange){
			device.onDeviceChange(device.devices);
		}
		device.checkNewTrackMetadata();
	}else if(type==0x08){
		device.log('< '+rinfo.address + ":" + rinfo.port+' 0_x'+typeStr+': You must change channels!');
		if(device.on0x08) device.on0x08(msg, rinfo);
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
			if(!rinfo.dst && device.usePDJL50001) device.send1x26(rinfo.address);
		}else{
			device.log(' 1_x2b Unknown sync assignment???', a);
		}
	}else if(type==0x26){
		device.log('< 1_x26 Acknowledge new master');
		device.handleNewMaster(msg[0x27]);
		if(!rinfo.dst && device.usePDJL50001) device.send1x27(rinfo.address);
	}else if(type==0x28){
		var data = {
			date: rinfo.tv_sec && new Date(rinfo.tv_sec*1000 + rinfo.tv_usec/1000),
			channel: msg[0x21],
			nextBeat1: msg.readUInt32BE(0x24),
			nextBeat2: msg.readUInt32BE(0x28),
			nextMeasure1: msg.readUInt32BE(0x2c),
			nextBeat4: msg.readUInt32BE(0x30),
			nextMeasure2: msg.readUInt32BE(0x34),
			nextBeat8: msg.readUInt32BE(0x38),
			tempo: msg.readUInt32BE(0x54)/0x100000,
			beat: msg[0x5c],
		};
		device.log('< '+rinfo.address + ":" + rinfo.port+'('+data.channel+') 1_x28 '+data.beat);
		// Emit a message whenever we get one of these status updates
		if(device.on1x28) device.on1x28(data);
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
		var track = new TrackReference(device, msg[0x28], msg[0x29], msg[0x2a], msg.readUInt32BE(0x2c));
		if(track.toString()=='0,0,0,0') track=null;
		var bpm = (msg[0x92]<<8) | (msg[0x93]);
		var data = {
			date: rinfo.tv_sec && new Date(rinfo.tv_sec*1000 + rinfo.tv_usec/1000),
			channel: msg[0x24],
			track: track,
			sourceid: [msg[0x24],msg[0x25],msg[0x26],msg[0x27],msg[0x28],msg[0x29],msg[0x2a],msg[0x2b]],
			sourceDevice: msg[0x28],
			sourceMedia: msg[0x29],
			sourceMediaStr: DJMDevice.mediaSourceMap[msg[0x29]],
			analyzedStatus: msg[0x2a],
			analyzedStatusStr: DJMDevice.analyzedStatus[msg[0x2a]],
			usbMountedByte: msg[0x6f],
			sdMountedByte: msg[0x73],
			discMountedByte: msg[0x76],
			trackid: msg.readUInt32BE(0x2c),
			discid: msg.slice(0x4c, 0x58).toString('hex'),
			playlistno: msg[0x33],
			state: msg[0x7b],
			stateStr: DJMDevice.playStateMap[msg[0x7b]],
			beat: msg[0xa6],
			totalBeats: (msg[0xa2]<<8) | (msg[0xa3]),
			trackBeats: (msg[0xa2]<<8) | (msg[0xa3]),
			playingSpeed: msg.readUInt32BE(0x98) / 0x100000, // the actual play rate that's coming out of the device, zero if stopped
			settingSpeed: msg.readUInt32BE(0xc0) / 0x100000, // play rate of the track with tempo slider position, but before jog wheel adjustments
			windSpeed: msg.readUInt32BE(0xc4) / 0x100000, // play rate of the track with current tempo settings if playing and fully up to speed
			bpm: bpm==65535 ? null : bpm/100, // BPM at current track position
			master: !!(msg[0x9e]&0x01),
		};
		device.log('< '+rinfo.address + ":" + rinfo.port+'('+data.channel+') 2_x0a '+data.beat+' '+data.totalBeats);
		// Emit a message whenever we get one of these status updates
		if(device.on2x0a) device.on2x0a(data);
		if(device.devices[data.channel] && data.track && !data.track.compare(device.devices[data.channel].track)){
			// Emit a message when the current playing track changes
			var oldTrack = device.devices[data.channel].track;
			device.devices[data.channel].track = data.track;
			device.devices[data.channel].trackMetadata = null;
			device.devices[data.channel].trackBeatgrid = null;
			device.devices[data.channel].trackInfoStatus = null;
			if(device.onTrackChangeDetect) device.onTrackChangeDetect(device.devices[data.channel], oldTrack);
			device.checkNewTrackMetadata();
		}
		if(device.devices[data.channel] && device.devices[data.channel].usbMountedByte!=data.usbMountedByte){
			if(data.usbMountedByte==4) device.detectMediaUnmount(data.channel, 3, data);
		}
		if(device.devices[data.channel] && device.devices[data.channel].sdMountedByte!=data.sdMountedByte){
			if(data.sdMountedByte==4) device.detectMediaUnmount(data.channel, 2, data);
		}
		var newMaster = msg[0x89]&0x20 || msg[0x9e]&0x01;
		if(!newMaster) return;
		var newMasterChannel = msg[0x21];
		if(newMasterChannel==device.channel) return;
		if(device.master!=newMasterChannel){
			device.log('< 2_x0a New master on ch.'+newMasterChannel.toString(16), msg[0x89].toByteString(), msg[0x9e].toByteString());
			device.handleNewMaster(newMasterChannel);
		}
	}else if(type==0x05){
		// We're getting asked about the NFS volume that another device just mounted
		var query = {
			channel: msg[0x21],
			chanext: msg[0x2b],
			source: msg[0x2f],
		};
		var response = {
			channel: device.channel,
			chanext: query.chanext,
			source: query.source,
			comment2c: 'Label',
			comment6c: '2016-02-02',
			comment84: '1000',
			trackCount: 1999,
			playlistCount: 32,
			sizeMB: 10000,
			freeMB: 4000,
		};
		if(!rinfo.dst && device.on2x06) device.on2x06(query);
		if(!rinfo.dst && device.usePDJL50002) device.send2x06(rinfo.address, response);
	}else if(type==0x10){
		// A rekordbox-specific packet it looks like, send 2_11
		setTimeout(function(){
			if(!rinfo.dst && device.usePDJL50002) device.send2x11(rinfo.address);
			if(!rinfo.dst && device.usePDJL50002) device.send2x16(rinfo.address);
			device.haveSent216 = true;
		}, 200);
		setTimeout(function(){
			if(!rinfo.dst && device.usePDJL50002) device.send2x16(rinfo.address);
		}, 5000);
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

DJMDevice.prototype.onTZSPPacket = function onTZSPPacket(msg, rinfo){
	var device = this;
	// First check the TZSP metadata
	if(msg[0]!==1) throw new Error('TZSP packet must be version 1');
	if(msg.readUInt16BE(2)!==1) throw new Error('TZSP packet must be Ethernet');
	for(var i=4; ; i++){
		var tagtype = msg[i];
		if(tagtype==0x00){
			i += 1;
			// padding, ignore
			continue;
		}
		if(tagtype==0x01){
			i += 1;
			// Marks last tag, break out of loop
			break;
		}
		throw new Error('Unknown TZSP tag type '+msg[i]);
	}
	var eth_msg = msg.slice(i);
	if(device.pcapStream){
		var pcapPacket = new Buffer(16);
		pcapPacket.writeUInt32BE(rinfo.tv_sec, 0);
		pcapPacket.writeUInt32BE(rinfo.tv_usec, 4);
		pcapPacket.writeUInt32BE(eth_msg.length, 8);
		pcapPacket.writeUInt32BE(eth_msg.length, 12);
		device.pcapStream.write(pcapPacket);
		device.pcapStream.write(eth_msg);
	}
	// Got our ethernet frame data, now figure it all out
	var mac_src = eth_msg.slice(0,6);
	var mac_dst = eth_msg.slice(6,12);
	// For now we ignore the possibility for an 802.1Q tag, that's not going to happen in our environment
	var ethertype = eth_msg.readUInt16BE(12);
	var ethpayload = eth_msg.slice(14);
	if(ethertype==0x0800){
		var ipv4_version = (ethpayload[0] & 0b11110000) >> 4;
		var ipv4_hsize = (ethpayload[0] & 0b00001111) << 2;
		if(ipv4_version!==4) throw new Error('Bad ipv4 header');
		var ipv4_length = ethpayload.readUInt16BE(2);
		var ipv4_proto = ethpayload.readUInt8(9);
		var ipv4_src = ethpayload.slice(12, 16);
		var ipv4_srcstr = Array.prototype.slice.call(ipv4_src).join('.');
		var ipv4_dst = ethpayload.slice(16, 20);
		var ipv4_dststr = Array.prototype.slice.call(ipv4_dst).join('.');
		var ipv4_payload = ethpayload.slice(ipv4_hsize, ipv4_length);
		if(ipv4_proto==0x01){
			// ICMP
			return;
		}else if(ipv4_proto==0x06){
			// TCP
			device.tcp_sessions = device.tcp_sessions || {};
			var tcp4_src = ipv4_payload.readUInt16BE(0);
			var tcp4_dst = ipv4_payload.readUInt16BE(2);
			var tcp4_seq = ipv4_payload.readUInt32BE(4);
			var tcp4_ack = ipv4_payload.readUInt32BE(8);
			var tcp4_hlen = (ipv4_payload[12] & 0b11110000) >> 2;
			var tcp4_opt = ipv4_payload.readUInt16BE(12) & 0b0000111111111111;
			var tcp4_sessionid = ipv4_srcstr+':'+tcp4_src+' '+ipv4_dststr+':'+tcp4_dst;
			var tcp4_sessionid_rev = ipv4_dststr+':'+tcp4_dst+' '+ipv4_srcstr+':'+tcp4_src;
			if(tcp4_opt & 2){
				// SYN time, first packet of connection
				var session = device.tcp_sessions[tcp4_sessionid] = device.tcp_sessions[tcp4_sessionid] || {};
				session.buffer = new Buffer([]);
				session.fragments = {};
				session.window = tcp4_seq + 1; // Indicates what byte offset session.buffer leaves off at
				if(tcp4_opt & 16){
					// Server replies with ACK
					session.serverid = tcp4_sessionid;
					session.clientid = tcp4_sessionid_rev;
					session.client = device.tcp_sessions[tcp4_sessionid_rev];
				}else{
					// Else this is a client
					session.clientid = tcp4_sessionid;
					session.serverid = tcp4_sessionid_rev;
					session.server = device.tcp_sessions[tcp4_sessionid_rev] = {};
				}
				session.address = ipv4_srcstr;
				session.port = tcp4_src;
			}else{
				var session = device.tcp_sessions[tcp4_sessionid];
			}
			var tcp4_payload = ipv4_payload.slice(tcp4_hlen);
			if(tcp4_payload.length){
				if(!session){
					console.error('Unknown session '+tcp4_sessionid);
					// assume this is the client since all our protocols are request-response
					var session = device.tcp_sessions[tcp4_sessionid] = device.tcp_sessions[tcp4_sessionid] || {};
					session.buffer = new Buffer([]);
					session.fragments = {};
					session.address = ipv4_srcstr;
					session.port = tcp4_src;
					var serversess = device.tcp_sessions[tcp4_sessionid_rev] = device.tcp_sessions[tcp4_sessionid_rev] || {};
					serversess.buffer = new Buffer([]);
					serversess.fragments = {};
					serversess.address = ipv4_dststr;
					serversess.port = tcp4_dst;
					session.server = serversess;
				}
				if(session.window===undefined){
					session.window = tcp4_seq;
				}
				session.fragments[tcp4_seq] = tcp4_payload;
				// append fragments onto the parsed data buffer
				var keys = Object.keys(session.fragments).map(function(v){return parseInt(v);}).sort(function(a,b){return a-b;});
				keys.forEach(function(k){
					if(k<session.window && k>session.window-(1<<30)){
						delete session.fragments[k];
						return;
					}else if(k==session.window){
						session.buffer = Buffer.concat([session.buffer, session.fragments[k]]);
						session.window = (session.window + session.fragments[k].length) & 0xffffffff;
						delete session.fragments[k];
						return;
					}
				});
				if(!session.buffer || !session.buffer.length) return;
				//console.log(session.buffer);
				var serversess = session.server || session;
				if(serversess.port==1051){
					//console.log('dbserver', ipv4_srcstr, ipv4_dststr, tcp4_payload);
					//try{console.log(DBSt.formatBuf(tcp4_payload));}catch(e){}
					session.lastDataDate = new Date;
					while(session.buffer && session.buffer.length){
						session.lastSyncDate = new Date;
						try{
							var message = DBSt.parseMessage(session.buffer);
							if(!message) break;
							session.buffer = session.buffer.slice(message.length);
							if(!(message instanceof DBSt.Item)) continue;
						}catch(e){
							console.error('Could not parse bytes:');
							console.error(session.buffer.toString('hex'));
							console.error(message);
							// Skip to next packet-looking thingy
							var nextMessage = session.buffer.indexOf(new Buffer('11872349ae','hex'), 1);
							if(nextMessage>0){
								console.error('Skipping '+nextMessage+' bytes to next magic number');
								session.buffer = session.buffer.slice(nextMessage);
							}else{
								// If nothing found then just nuke the thing
								session.buffer = new Buffer([]);
							}
							continue;
						}
						try{
							var info = DBSt.parseItem(message);
						}catch(e){
							console.error('Could not parse message:');
							console.error(session.buffer.toString('hex'));
							console.error(message);
							continue;
						}
						if(session.server){
							// If this is the client, tag the server session with the request it's supposedly currently processing
							session.server.pendingRequest = info;
						}else if(session.pendingRequest){
							// Look up the request this is a response to
							if(session.pendingRequest.requestId==info.requestId){
								var request = session.pendingRequest;
							}
						}else{
							console.error('Parsed message without pending request '+info.constructor.name);
						}
						if(request){
							// Which channel is the request being made to?
							var sourceChan = undefined;
							for(var chan in device.devices){
								if(session.address==device.devices[chan].address){
									sourceChan = device.devices[chan].channel;
								}
							}
							if(info instanceof DBSt.Item4000){
								session.currentNavRequest = request;
								session.currentNavResponse = info;
							}
							if(info instanceof DBSt.Item4a02){
								var track = new TrackReference(device, sourceChan, request.sourceMedia, request.sourceAnalyzed, request.resourceId);
								device.haveWaveformDetail(track, info);
							}
							if(info instanceof DBSt.Item4402){
								var track = new TrackReference(device, sourceChan, request.sourceMedia, request.sourceAnalyzed, request.resourceId);
								device.haveWaveformSummary(track, info);
							}
							if(info instanceof DBSt.Item4602){
								var track = new TrackReference(device, sourceChan, request.sourceMedia, request.sourceAnalyzed, request.resourceId);
								device.haveBeatgrid(track, info);
							}
							if(info instanceof DBSt.Item4702){
								var track = new TrackReference(device, sourceChan, request.sourceMedia, request.sourceAnalyzed, request.resourceId);
								console.log('Have track cuepoints '+track);
								if(device.onTrackCuepoints) device.onTrackCuepoints(info);
							}
							if(info instanceof DBSt.Item4001){
								info.items = [];
								info.footer = null;
								session.activeResponse = info;
							}else if(info instanceof DBSt.Item41){
								session.activeResponse.items.push(info);
							}else if(info instanceof DBSt.Item42){
								session.activeResponse.footer = info;
								if(session.currentNavRequest instanceof DBSt.Item2002){
									// Track metadata (title, artist, album, genre, comment, album art)
									var track = new TrackReference(device, sourceChan, session.currentNavRequest.sourceMedia, session.currentNavRequest.sourceAnalyzed, session.currentNavRequest.resourceId);
									device.haveTrackMetadata(track, session.activeResponse);
								}
								if(session.currentNavRequest instanceof DBSt.Item2102){
									// Track link information (title, file path, and other things)
									//var track = new TrackReference(device, sourceChan, session.currentNavRequest.sourceMedia, session.currentNavRequest.sourceAnalyzed, //session.currentNavRequest.resourceId);
									//device.haveTrackMetadata(track, session.activeResponse);
								}
							}
						}
					}
				}else{
					//console.log('tcp4', ipv4_srcstr+':'+tcp4_src, ipv4_dststr+':'+tcp4_dst, ipv4_proto.toString(16), tcp4_payload);
				}
			}
		}else if(ipv4_proto==0x11){
			if(ipv4_payload.length<8){
				console.error('UDP4 packet not long enough');
				console.error(eth_msg.toString('hex'));
				return;
			}
			// UDP
			var udp4_src = ipv4_payload.readUInt16BE(0);
			var udp4_dst = ipv4_payload.readUInt16BE(2);
			var udp4_len = ipv4_payload.readUInt16BE(4);
			var udp4_chk = ipv4_payload.readUInt16BE(6);
			var udp4_payload = ipv4_payload.slice(8);
			var rinfo = {
				size: udp4_len,
				tv_sec: rinfo.tv_sec,
				tv_usec: rinfo.tv_usec,
				family: 'IPv4',
				address: ipv4_srcstr,
				port: udp4_src,
				dst: ipv4_dststr,
				dstport: udp4_dst,
			};
			//console.log('udp4', ipv4_srcstr+':'+udp4_src, ipv4_dststr+':'+udp4_dst, ipv4_proto.toString(16));
			if(udp4_dst===50000){
				device.onMsg0(udp4_payload, rinfo);
			}else if(udp4_dst===50001){
				device.onMsg1(udp4_payload, rinfo);
			}else if(udp4_dst===50002){
				device.onMsg2(udp4_payload, rinfo);
			}
		}else{
			//console.log(ethpayload.toString('hex'));
			//throw new Error('Unknown IPv4 protocol 0x'+ipv4_proto.toString(16));
			console.log('Unknown IPv4 protocol 0x'+ipv4_proto.toString(16));
		}
	}else if(ethertype==0x0806){
		// ARP, ignore
	}else if(ethertype==0x86DD){
		// IPv6, ignore
	}else{
		throw new Error('Unknown Ethertype 0x'+ethertype.toString(16));
	}
}

DJMDevice.prototype.log = function log(){
	console.log.apply(console, arguments);
}

DJMDevice.prototype.deviceTypeNameBuf = function deviceTypeNameBuf(){
	// idk if this is supposed to be null-terminated, but let's assume so.
	if(typeof this.deviceTypeName!='string' || this.deviceTypeName.length>=20){
		throw new Error('Invalid deviceTypeName');
	}
	var b = this.deviceTypeName+"\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0";
	return b.substring(0,19)+"\0";
}

DJMDevice.prototype.handleNewMaster = function handleNewMaster(ch){
	var device = this;
	if(device.master===ch) return;
	var oldMaster = ch;
	device.master = ch;
	if(device.onNewMaster) device.onNewMaster(ch);
}

DJMDevice.prototype.checkNewTrackMetadata = function checkNewTrackMetadata(){
	var device = this;
	var articles = [
		function requestMetadata(remote, cb){
			if(!device.useDbclient) return void cb();
			if(!device.onTrackChangeMetadata) return void cb();
			remote.track.getMetadata(function(err, meta){
				cb();
			});
		},
		function requestBeatgrid(remote, cb){
			if(!device.useDbclient) return void cb();
			if(!device.onTrackChangeBeatgrid) return void cb();
			remote.track.getBeatgrid(function(err, meta){
				cb();
			});
		},
	];
	for(var ch in this.devices) (function(remote){
		if(!remote.track) return;
		if(!device.devices[remote.track.channel]) return;
		if(remote.trackInfoStatus) return;
		remote.trackInfoStatus = 1;
		function nextArticle(i){
			var articleFn = articles[i];
			if(!articleFn) return void done();
			articleFn(remote, nextArticle.bind(null, i+1));
		}
		nextArticle(0);
		function done(){
			remote.trackInfoStatus = 2;
		}
	})(device.devices[ch]);
}

DJMDevice.prototype.sendDBSQuery = function sendDBSQuery(chan, request, callback){
	if(!this.useDbclient) throw new Error('useDbclient disabled');
	this.getDBSSocket(chan, function(err, sock){
		sock.issueRequest(request, callback);
	});
}

DJMDevice.prototype.getDBSSocket = function getDBSSocket(chan, callback){
	var device = this;
	var target = device.devices[chan];
	if(!target) throw new Error('No device '+chan);
	if(target.dbsSocket) return void process.nextTick(function(){
		callback(null, target.dbsSocket);
	});
	var port = 1051;
	var address = target.address;
	function debug(){
		//console.log.apply(console, arguments);
	};
	var sock = target.dbsSocket = net.connect(port, address);
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
		debug(DBSt.formatBuf(request.toBuffer()));
		sock.write(request.toBuffer());
		return rid;
	}
	sock.toJSON = function(){};
	sock.on('data', function(newdata){
		debug('< Response');
		data = Buffer.concat([data, newdata]);
		debug(DBSt.formatBuf(data));
		for(var message; message = DBSt.parseMessage(data);){
			handleMessage(message);
			data = data.slice(message.length);
			if(!data.length) break;
		}
		function handleMessage(){
			debug('Response class: '+message.constructor.name);
			// Parse message contents
			if(message instanceof DBSt.Item){
				var info = DBSt.parseItem(message, data.slice(0,message.length));
			}else{
				var info = message;
			}
			DBSt.assertParsed(data.slice(0,message.length), info);
			debug(info);
			debug('Response type: '+info.constructor.name);
			if(info instanceof DBSt.ItemHandshake){
				debug('> ItemHello');
				debug(DBSt.formatBuf(new DBSt.ItemHello(device.channel).toBuffer()));
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
				debug('Have header');
				return;
			}
			if(info instanceof DBSt.Item41){
				// This is an item in a series, wait for the footer element
				req.header = info;
				req.items.push(info);
				debug('Have item');
				return;
			}
			// Handle footer elements and anything else
			if(req.done){
				//delete requests[rid];
				req.done(null, req, info);
			}else{
				console.error('Unhandled packet!');
			}
		}
	});
	sock.on('end', function(){
		console.error('DBS connection closed!');
		for(var n in requests){
			requests[n].done(new Error('Connection closed'));
		}
		for(var n in requests){
			delete requests[n];
		}
		target.dbsSocket = null;
	});
}

// 50000 0x0a
DJMDevice.prototype.send0x0a = function send0x0a(){
	var device = this;
	var b = Buffer([
		0x51, 0x73, 0x70, 0x74, 0x31, 0x57, 0x6d, 0x4a, 0x4f, 0x4c, 0x0a, 0x00, 0x00, 0x00, 0x00, 0x00,
		0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		0x01, 0x02, 0x00, 0x25, 0x01,
	]);
	b.write(device.deviceTypeNameBuf(), 0x0c, 0x0c+20);
	device.sock0.send(b, 0, b.length, 50000, device.broadcastIP, function(e){
		device.log('> 0x_0a', device.broadcastIP, arguments);
	});
}

// 50000 0x00
DJMDevice.prototype.send0x00 = function send0x00(seq){
	var device = this;
	var m = MACToArr(device.macaddr);
	var dtyp = device.deviceType8;
	var x25 = (device.hardwareMode=='rekordbox') ? 0x04 : 0x01 ; // Rekordbox sends 0x04 for some reason
	var b = Buffer([
		0x51, 0x73, 0x70, 0x74, 0x31, 0x57, 0x6d, 0x4a, 0x4f, 0x4c, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		0x01, dtyp, 0x00, 0x2c, seq,  x25,  m[0], m[1], m[2], m[3], m[4], m[5],
	]);
	b.write(device.deviceTypeNameBuf(), 0x0c, 0x0c+20);
	device.sock0.send(b, 0, b.length, 50000, device.broadcastIP, function(e){
		device.log('> 0_x00', arguments);
	});
}


// 50000 0x02
// i: an incrementing number for every packet that goes out (usually 1, 2, or 3)
// target: IP address of mixer, if this packet is not being broadcast, or null if it is
// channelAssignment: "auto" or "manual"
// chan: 0 if channelAssignment is "auto"
DJMDevice.prototype.send0x02 = function send0x02(seq, target, chan){
	var device = this;
	var dtyp = device.deviceType8;
	var n = IPToArr(device.ipaddr);
	var m = MACToArr(device.macaddr);
	if(chan===undefined) chan = device.channel;
	var x30 = (device.hardwareMode=='rekordbox') ? 0x04 : 0x01 ; // Rekordbox sends 0x04 for some reason
	var x31 = 2; // 1=Auto, 2=Manual
	// This 0x0b byte gets set to 1 if we want to get assigned a channel by the mixer
	// We won't get any response back if set to 0
	var bcst =  target ? 0x01 : 0x00 ;
	var target = target || device.broadcastIP;
	var b = Buffer([
		0x51, 0x73, 0x70, 0x74, 0x31, 0x57, 0x6d, 0x4a, 0x4f, 0x4c, 0x02, bcst, 0x00, 0x00, 0x00, 0x00,
		0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		0x01, dtyp, 0x00, 0x32, n[0], n[1], n[2], n[3], m[0], m[1], m[2], m[3], m[4], m[5], chan, seq,
		x30,  x31,
	]);
	b.write(device.deviceTypeNameBuf(), 0x0c, 0x0c+20);
	device.sock0.send(b, 0, b.length, 50000, target, function(e){
		device.log('> 0_x02');
	});
}

// 50000 0x04
DJMDevice.prototype.send0x04 = function send0x04(i){
	var device = this;
	var chan = device.channel;
	var b = Buffer([
		0x51, 0x73, 0x70, 0x74, 0x31, 0x57, 0x6d, 0x4a, 0x4f, 0x4c, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00,
		0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		0x01, 0x02, 0x00, 0x26, chan, i
	]);
	b.write(device.deviceTypeNameBuf(), 0x0c, 0x0c+20);
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
	// What is this?
	var x25 = 1;
	var x34 = (device.hardwareMode=='rekordbox') ? 0x04 : 0x01 ; // Rekordbox sends 0x04 for some reason
	var b = Buffer([
		0x51, 0x73, 0x70, 0x74, 0x31, 0x57, 0x6d, 0x4a, 0x4f, 0x4c, 0x06, 0x00, 0x00, 0x00, 0x00, 0x00,
		0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		0x01, 0x02, 0x00, 0x36, chan, x25,  m[0], m[1], m[2], m[3], m[4], m[5], n[0], n[1], n[2], n[3],
		ndev, 0x00, 0x00, 0x00, x34,  0x00
	]);
	b.write(device.deviceTypeNameBuf(), 0x0c, 0x0c+20);
	b.writeUInt8(device.deviceType8, 0x21);
	if(device.hardwareMode=='rekordbox'){
		b.writeUInt8(1, 0x31); // No clue what this does yet
		b.writeUInt8(8, 0x35); // No clue what this does yet
	}
	device.sock0.send(b, 0, b.length, 50000, device.broadcastIP, function(e){
		device.log('> 0_x06');
	});
}

// 0=Start, 1=Stop, 2=none
DJMDevice.prototype.send1x02 = function send1x02(c){
	// Send a fader start packet
	var device = this;
	var chan = device.channel;
	var b = Buffer([
		0x51, 0x73, 0x70, 0x74, 0x31, 0x57, 0x6d, 0x4a, 0x4f, 0x4c, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00,
		0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01,
		0x00, chan, 0x00, 0x04, c[0], c[1], c[2], c[3],
	]);
	// This would normally have a device name 'DJM-2000nexus'
	b.write(device.deviceTypeNameBuf(), 0x0b, 0x0b+20);
	device.sock1.send(b, 0, b.length, 50001, device.broadcastIP, function(e){
		device.log('> 1_x02');
	});
}

// This specifically talks about the device-to-device 2_0a packet
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
	var br = 0xff;
	var b4 = 0;
	if(device.cdjMediaState){
		br = 256-(beat%256);
		b4 = (beat%4)+1;
	}
	var isMaster = (device.master==device.channel);
	var e = 0x8c | (isMaster?0x20:0x00) | (device.sync?0x10:0x00);
	var x9e = isMaster ? 0x02 : 0x00 ;
	var f = device.firmwareVersion;
	var t = [0x00, 0x10, 0x00, 0x00]; // Track tempo = 100%
	var p = [(pid>>24)&0xff, (pid>>16)&0xff, (pid>>8)&0xff, pid&0xff]; // Packet id
	// A blank packet with no track looks like this:
	//0000   51 73 70 74 31 57 6d 4a 4f 4c 0a 43 44 4a 2d 32
	//0010   30 30 30 6e 65 78 75 73 00 00 00 00 00 00 00 01
	//0020   03 02 00 b0 02 00 00 00 00 00 00 00 00 00 00 00
	//0030   00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
	//0040   00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
	//0050   00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
	//0060   00 00 00 00 00 00 00 00 01 00 04 06 00 00 00 04
	//0070   00 00 00 00 00 02 00 00 00 00 00 00 31 2e 32 35
	//0080   00 00 00 00 00 00 00 01 00 84 0a 7e 00 10 00 00
	//0090   7f ff ff ff 7f ff ff ff 00 00 00 00 00 00 00 ff
	//00a0   ff ff ff ff 01 ff 00 00 00 00 00 00 00 00 00 00
	//00b0   00 00 00 00 00 00 01 00 00 00 00 00 00 00 00 00
	//00c0   00 10 00 00 00 00 00 00 00 00 00 09 0f 00 00 00
	//00d0   00 00 00 00
	// A packet playing a CD looks like:
	//0070   00 00 00 04 00 00 00 00 00 00 00 00 31 2e 32 35
	//0080   00 00 00 00 00 00 00 02 00 84 ff 7e 00 10 00 00
	//0090   7f ff ff ff 7f ff ff ff 00 00 00 00 00 00 00 ff
	//00a0   ff ff ff ff 01 ff 00 00 00 00 00 00 00 00 00 00
	//00b0   00 00 00 00 00 00 01 00 00 00 00 00 00 00 00 00
	//00c0   00 10 00 00 00 00 00 00 00 00 21 eb 0f 00 00 00
	//00d0   00 00 00 00
	var b = Buffer([
		0x51, 0x73, 0x70, 0x74, 0x31, 0x57, 0x6d, 0x4a, 0x4f, 0x4c, 0x0a, 0x00, 0x00, 0x00, 0x00, 0x00,
		0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01,
		0x03, chan, 0x00, 0xb0, chan, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x1e, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x08, 0x00, 0x00, 0x08, 0x00, 0x2e, 0x93, 0x03, 0x00,
		0xf4, 0x72, 0x00, 0x00, 0xb3, 0x24, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x22, 0x04, 0x04, 0x00, 0x00, 0x00, 0x04,
		0x00, 0x00, 0x00, 0x04, 0x00, 0x01, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, f[0], f[1], f[2], f[3],
		0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, e,    0x0d, 0x7c, t[0], t[1], t[2], t[3],
		0x00, 0x00, 0xff, 0xff, 0x7f, 0xff, 0xff, 0xff, t[0], t[1], t[2], t[3], 0x00, 0x01, x9e,  0xff,
		0xff, 0xff, 0xff, 0xff, 0x00, br,   b4,   0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		t[0], t[1], t[2], t[3], t[0], t[1], t[2], t[3], p[0], p[1], p[2], p[3], 0x0f, 0x00, 0x00, 0x00,
		0x00, 0x00, 0x00, 0x00
	]);
	b.write(device.deviceTypeNameBuf(), 0x0b, 0x0b+20);
	// Various bytes for lamp indicators
	var lamp_sd =  device.hasSD;
	var lamp_usb = device.hasUSB;
	b[0x6a] = lamp_sd ? 0x04 : 0x08;
	b[0x6b] = lamp_usb ? 0x04 : 0x08;
	// Declare if stuff is plugged in
	// If so indicated, the SD and USB fields will cause other CDJ devices to attempt an NFS mount of the data
	b[0x6f] = device.hasUSB ? 0x00 : 0x04;
	b[0x73] = device.hasSD ? 0x00 : 0x04;
	b[0x76] = device.hasCD ? 0x04 : 0x00; // yeah it's backwards here. This might get overridden in 'cd' section below.
	// Is it playing?
	switch(device.cdjMediaState){
		case 'none': b[0x7b] = 0; break;
		case 'loading': b[0x7b] = 2; break;
		case 'play': b[0x7b] = 3; break;
		case 'cue': b[0x7b] = 6; break;
		case 'cueplay': b[0x7b] = 7; break;
		case 'seek': b[0x7b] = 9; break;
		default: throw new Error('Unknown cdjMediaState '+JSON.stringify(device.cdjMediaState));
	}
	if(device.beatinfoBPM){
		b[0x92] = (device.beatinfoBPM>>8)&0xff;
		b[0x93] = (device.beatinfoBPM>>0)&0xff;
	}
	// Include track metadata based on what source we're emulating
	if(device.cdjMediaSource=='cd'){
		// A CD doesn't include analysis information, but can include artist/album/track metadata (not here, though, in different packets)
		// x28 sourceid field
		b[0x28] = 0x02;
		b[0x29] = 0x01;
		b[0x2a] = 0x05;
		b[0x2b] = 0x00;
		// Track ID
		b[0x2c] = 0x01;
		// Disc ID
		var discId = [0x61,0x1d,0x05,0x00,0x62,0x86,0x00,0x00,0x43,0xc7,0x04,0x00];
		discId.forEach(function(v, i){ b[0x4c+i] = v; });
		b[0x76] = 0x04; // Force disc to show as mounted
		// Beat information will be unknown
		b[0xa2] = 0xff; // Beats since start 1
		b[0xa3] = 0xff; // Betas since start 2
		b[0xa5] = 0xff; // Beats to next cuepoint
		b[0xa6] = 0; // beat 1..4
	}else if(device.cdjMediaSource=='sd' || device.cdjMediaSource=='usb' || device.cdjMediaSource=='link'){
		// Include track analysis information
		// This isn't necessarially always true, TODO add a flag to provide or hide analysis information
		// Beat count, if any
		b[0xa2] = (beat>>8)&0xff;
		b[0xa3] = (beat>>0)&0xff;
		b[0xa5] = (beat>>0)&0xff;
		b[0xa6] = (beat>>0)&0xff;
		if(device.cdjMediaState=='play'){
		}
	}
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
		0x51, 0x73, 0x70, 0x74, 0x31, 0x57, 0x6d, 0x4a, 0x4f, 0x4c, 0x27, 0x00, 0x00, 0x00, 0x00, 0x00,
		0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01,
		0x00, chan, 0x00, 0x08, 0x00, 0x00, 0x00, chan, 0x00, 0x00, 0x00, 0x01,
	]);
	b.write(device.deviceTypeNameBuf(), 0x0b, 0x0b+20);
	device.sock1.send(b, 0, b.length, 50001, ip, function(e){
		device.log('> 1_x27', arguments);
	});
}

// This packet sends basic beat information including:
// time to next beat, tempo percentage, BPM, and the beat number
// Broadcast once every beat while a track is playing
DJMDevice.prototype.send1x28 = function send1x28(i){
	// 50001 0x28
	var device = this;
	var chan = device.channel;
	var tempo = 120; // in beats per second
	var beat = i%4 + 1;
	var durations = [
		Math.round(60000/tempo), // ms to next beat
		Math.round(60000/tempo*2), // ms to beat after next
		Math.round(60000/tempo*(4-beat+1)), // ms to start of next measure
		Math.round(60000/tempo*4), // ms to 4 beats out
		Math.round(60000/tempo*(8-beat+1)), // ms to measure after next
		Math.round(60000/tempo*8), // ms to 8 beats out
	];
	var tempoBytes = Math.round(0x100000 * tempo);
	var ip = device.broadcastIP;
	var b = Buffer([
		0x51, 0x73, 0x70, 0x74, 0x31, 0x57, 0x6d, 0x4a, 0x4f, 0x4c, 0x28, 0x00, 0x00, 0x00, 0x00, 0x00,
		0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01,
		0x00, 0x02, 0x00, 0x3c, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
		0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
		0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
		0xff, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, beat, 0x00,
	]);
	b.write(device.deviceTypeNameBuf(), 0x0b, 0x0b+20);
	b.writeUInt32LE(durations[0], 0x24);
	b.writeUInt32LE(durations[1], 0x28);
	b.writeUInt32LE(durations[2], 0x2c);
	b.writeUInt32LE(durations[3], 0x30);
	b.writeUInt32LE(durations[4], 0x34);
	b.writeUInt32LE(durations[5], 0x38);
	device.sock1.send(b, 0, b.length, 50001, ip, function(e){
		device.log('> 1_x28', arguments);
	});
}

DJMDevice.prototype.send2x06 = function send2x06(ip, data){
	// 50002 0x11
	// The CDJ will send its first portmap request to rekordbox in response to this packet
	var device = this;
	var chan = device.channel;
	var b = Buffer(0xc0);
	b.fill();
	for(var i=0; i<10; i++) b[i] = DJMDevice.magic[i];
	b[0xa] = 0x06;
	b.write(device.deviceTypeNameBuf(), 0x0b, 0x0b+20);
	b[0x1f] = 0x01;
	b[0x20] = (device.hardwareMode=='rekordbox' ? 0x01 : 0x00);
	b[0x21] = device.channel;
	b[0x22] = 0x00; // length[0]
	b[0x23] = 0x9c; // length[1]
	// packet-specific payload now
	b[0x27] = data.chanext;
	b[0x2b] = data.source;
	b[0x2d] = 0x20; // Don't know what this is
	// Copy strings (UTF-16BE)
	for(var i=0; i<10; i++) b.writeUInt16BE(data.comment2c.charCodeAt(i)||0, 0x2c+i*2);
	for(var i=0; i<10; i++) b.writeUInt16BE(data.comment6c.charCodeAt(i)||0, 0x6c+i*2);
	for(var i=0; i<4; i++) b.writeUInt16BE(data.comment84.charCodeAt(i)||0, 0x84+i*2);
	b.writeUInt16BE(data.trackCount, 0xa6);
	// Color byte: {0=default, 1=magenta, 2=red, 3=orange, 4=yellow, 5=green, 6=blue, 7=blue, 8=violet, 9=nothing special etc}
	var color = 0x00;
	b[0xa8] = color;
	b[0xa9] = 0x00;
	b[0xaa] = 0x01;
	var has_settings = false; // Triggers the "Press Menu to load settings" notice
	b[0xab] = has_settings ? 1 : 0 ;
	b.writeUInt16BE(data.playlistCount, 0xae);
	b.writeUInt32BE(data.sizeMB, 0xb2);
	b.writeUInt32BE(data.freeMB, 0xba);
	// End of packet
	device.sock2.send(b, 0, b.length, 50002, ip, function(e){
		device.log('> 2_06', arguments);
	});
}


DJMDevice.prototype.send2x11 = function send2x11(ip){
	// 50002 0x11
	// The CDJ will send its first portmap request to rekordbox in response to this packet
	var device = this;
	var chan = device.channel;
	var b = Buffer(296);
	b.fill();
	for(var i=0; i<10; i++) b[i] = DJMDevice.magic[i];
	b[0xa] = 0x11;
	b.write(device.deviceTypeNameBuf(), 0x0b, 0x0b+20);
	b[0x1f] = 0x01;
	b[0x20] = (device.hardwareMode=='rekordbox' ? 0x01 : 0x00);
	b[0x21] = device.channel;
	b[0x22] = 0x01; // length[0]
	b[0x23] = 0x04; // length[1]
	b[0x24] = device.channel;
	// One of these probably controls NFS information
	b[0x25] = 0x01;
	b[0x26] = 0;
	b[0x27] = 0;
	// Copy hostname (UTF-16BE)
	for(var i=0; i<25; i++) b.writeUInt16BE(device.hostname.charCodeAt(i)||0, 0x28+i*2);
	// End of packet
	device.sock2.send(b, 0, b.length, 50002, ip, function(e){
		device.log('> 2_11', arguments);
	});
}

DJMDevice.prototype.send2x16 = function send2x16(ip){
	// 50002 0x16
	// This packet causes the CDJ to try to mount the NFS volume
	var device = this;
	var chan = device.channel;
	var b = Buffer(0x30);
	b.fill();
	for(var i=0; i<10; i++) b[i] = DJMDevice.magic[i];
	b[0xa] = 0x16; // 2_16 type indicator
	b.write(device.deviceTypeNameBuf(), 0x0b, 0x0b+20);
	b[0x1f] = 0x01;
	b[0x20] = (device.hardwareMode=='rekordbox' ? 0x01 : 0x00);
	b[0x21] = device.channel;
	// The rest of the packet seems to be zeros, even the "Length" field
	device.sock2.send(b, 0, b.length, 50002, ip, function(e){
		device.log('> 2_16', arguments);
	});
}

DJMDevice.prototype.send2x29 = function send2x29(){
	// 50002 0x29
	// The CDJ will send a second portmap request to rekordbox in response to this packet
	var device = this;
	var chan = device.channel;
	var b = Buffer(0x38);
	b.fill();
	for(var i=0; i<10; i++) b[i] = DJMDevice.magic[i];
	b[0xa] = 0x29; // type indicator
	b.write(device.deviceTypeNameBuf(), 0x0b, 0x0b+20);
	b[0x1f] = 0x01;
	b[0x20] = (device.hardwareMode=='rekordbox' ? 0x01 : 0x00);
	b[0x21] = device.channel;
	// What typically seems to be the length is... incorrect
	b[0x22] = 0; // length[0]
	b[0x23] = 0x38; // length[1]
	b[0x24] = device.channel;
	// This is probably all track stuff... but these values are taken from Rekordbox
	b[0x27] = 0xc0;
	b[0x29] = 0x10;
	b[0x31] = 0x10;
	b[0x35] = 0x09;
	b[0x36] = 0xff;
	b[0x37] = 0; // Current beat
	device.sock2.send(b, 0, b.length, 50002, device.broadcastIP, function(e){
		device.log('> 2_29', arguments);
	});
}

DJMDevice.prototype.sendDeviceAck = function sendDeviceAck(ip){
	// 50000 0x05
	var device = this;
	var c = device.channel;
	var b = Buffer([
		0x51, 0x73, 0x70, 0x74, 0x31, 0x57, 0x6d, 0x4a, 0x4f, 0x4c, 0x05, 0x00, 0x44, 0x4a, 0x4d, 0x2d,
		0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		0x01, 0x02, 0x00, 0x26, c,    0x01,
	]);
	b.write(device.deviceTypeNameBuf(), 0x0c, 0x0c+20);
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
		var seqx = 0;
		var timeout = null;
		if(device.negotiationMode=='rekordbox'){
			var searchspace = [0x11, 0x12, 0x29, 0x2a, 0x2b, 0x2c];
			var period = 100;
			var seqct = 6;
		}else{
			var searchspace = [device.channel];
			var period = 300;
			var seqct = 3;
		}
		var searchspaceoccupied = {};
		searchspace.forEach(function(n){ searchspaceoccupied[n] = false; });
		device.on0x03 = function(msg, rinfo){
			clearTimeout(timeout);
			device.channel = msg[0x24];
			step0x04();
		};
		device.on0x08 = function(msg, rinfo){
			// TODO remove the offending channel from consideration
		};
		function sendNext(){
			while(seq<=seqct){
				// The mixer wants us to ask for a channel directly instead of a broadcast
				var chan = searchspace[seqx++];
				if(seqx==searchspace.length){
					// this is what we'll end up using/testing next time
					seqx = 0;
					seq++;
				}
				// If channel was already marked occupied, skip it
				if(searchspaceoccupied[chan]) continue;
				// If not, ask to see if it's occupied
				device.send0x02(seq, mixerIp, chan);
				timeout = setTimeout(sendNext, period);
				return;
			}
			// If we've tested all the channels, then use the first unoccupied one
			var goodChannels = searchspace.filter(function(c){ return !searchspaceoccupied[c]; });
			device.channel = goodChannels[0];
			clearTimeout(timeout);
			step0x04();
			return;
		}
		sendNext();
	}
	function step0x04(){
		var seq = 1;
		var timeout;
		device.on0x05 = function(msg, rinfo){
			clearTimeout(timeout);
			device.on0x05 = found0x05;
			device.send0x06();
			device.doDiscoverable();
		};
		function found0x05(){
			device.log('Duplicate 0x05 response from server');
		}
		function sendNext(){
			if(seq>3){
				clearTimeout(timeout);
				device.log('Weare the first device on the network?');
				device.doDiscoverable();
				return;
			}
			if(device.useBoot004){
				device.send0x04(seq);
			}else{
				device.doDiscoverable();
				return;
			}
			timeout = setTimeout(sendNext, 300);
			seq++;
		}
		sendNext();
	}
}
// (re-)Sets up the packet sending services
DJMDevice.prototype.doDiscoverable = function doDiscoverable(){
	var device = this;
	device.connected = true;
	if(device.timerSend0x06) clearInterval(device.timerSend0x06);
	// every two seconds
	device.timerSend0x06 = setInterval(function(){
		device.send0x06();
	}, 2000);

	if(device.timerSend1x28) clearInterval(device.timerSend1x28);
	// every beat
	if(device.useBeat128){
		device.timerSend1x28 = setInterval(function(){
			if(device.haveBeatinfo){
				device.send1x28(device.beatinfoBeat);
			}
			++device.beatinfoBeat;
		}, parseInt(60000/device.beatinfoBPM));
	}

	if(device.timerEmitBeatInfo) clearInterval(device.timerEmitBeatInfo);
	// 10 times a second
	if(device.useBeat20a){
		device.timerEmitBeatInfo = setInterval(function(){
			device.emitBeatinfo();
		}, 100);
	}

	if(device.timerSend2x29) clearInterval();
	if(device.useBeat229){
		device.timerSend2x29 = setInterval(function(){
			if(device.haveSent216) device.send2x29();
		}, 100);
	}

	if(device.onListening){
		device.onListening();
	}
}

DJMDevice.prototype.startTZSPClient = function(remoteAddr){
	var device = this;
	device.tzspcBackoff = device.tzspcBackoff || 0;
	device.tzspc = net.connect(37008, remoteAddr);
	device.tzspc.setNoDelay(true);
	device.tzspc.resume();
	device.tzspcBuf = null;
	device.tzspc.on('connect', function(buf){
		console.log('Connected to TZSP client '+remoteAddr);
	});
	device.tzspc.on('data', function(buf){
		if(device.tzspcBuf){
			buf = Buffer.concat([device.tzspcBuf, buf]);
		}
		while(true){
			if(buf.length < 12) return;
			var len = buf.readUInt16BE(0);
			var seq = buf.readUInt16BE(2);
			var tv_sec = buf.readUInt32BE(4);
			var tv_usec = buf.readUInt32BE(8);
			//console.log('Packet', seq);
			if(buf.length < len){
				device.tzspcBuf = buf;
				return;
			}
			var packet = buf.slice(12, len);
			device.onTZSPPacket(packet, {len:len, seq:seq, tv_sec:tv_sec, tv_usec:tv_usec});
			if(buf.length > len){
				buf = device.tzspcBuf = buf.slice(len);
			}else{
				device.tzspcBuf = null;
				return;
			}
		}
	});
	device.tzspc.on('end', function(buf){
		console.error('Server closed TZSPC connection');
		setTimeout(device.startTZSPClient.bind(device, remoteAddr), 100*Math.pow(1.1, ++device.tzspcBackoff));
	});
	device.tzspc.on('error', function(e){
		console.error('TZSP connection error');
		setTimeout(device.startTZSPClient.bind(device, remoteAddr), 100*Math.pow(1.1, ++device.tzspcBackoff));
	});
}

DJMDevice.prototype.boot = function boot(){
	var device = this;
	var wait = 300;
	var i = 0;
	if(device.useBoot00a){
		setTimeout(this.send0x0a.bind(this), (i++)*wait);
		setTimeout(this.send0x0a.bind(this), (i++)*wait);
		setTimeout(this.send0x0a.bind(this), (i++)*wait);
	}
	setTimeout(this.doBootup.bind(this), i*wait);
}

DJMDevice.prototype.detectMediaUnmount = function detectMediaUnmount(channel, media, packetData){
	var device = this;
	// First go through all the tracks in the cache and purge the ones that were associated with the media
	for(var n in device.tracks){
		var track = device.tracks[n];
		if(track.track.channel==channel && track.track.media==media){
			delete device.tracks[n];
			continue;
		}
	}
}

DJMDevice.prototype.haveTrackMetadata = function haveTrackMetadata(track, info){
	var device = this;
	var trackdata = device.tracks[track] = device.tracks[track] || {track:track};

	var metadata = trackdata.metadata = {};
	info.items.forEach(function(v){
		var key = DBSt.itemTypeLabels[v.symbol] || v.symbol.toString(16);
		var value = v.label || v.numeric;
		metadata[key] = value;
	});

	if(device.onTrackMetadata) device.onTrackMetadata(track, info);
	for(var chan in device.devices){
		var remote = device.devices[chan];
		if(remote && track.compare(remote.track) && !track.compare(remote.trackMetadata)){
			remote.trackMetadata = remote.track;
			if(device.onTrackChangeMetadata) device.onTrackChangeMetadata(remote, track);
		}
	}
}

DJMDevice.prototype.haveBeatgrid = function haveBeatgrid(track, info){
	var device = this;
	var trackdata = device.tracks[track] = device.tracks[track] || {track:track};
	if(!info || !info.body){
		trackdata.beatgrid = null;
		trackdata.beats = [];
		return;
	}
	trackdata.beatgrid = info.body;
	trackdata.beats = [{beat:0, time:0}];
	for(var i=20; info.body[i]; i+=16){
		var beatData = info.body.slice(i, i+16);
		trackdata.beats.push({
			beat: beatData[0],
			time: beatData.readUInt32LE(4),
			//data: beatData,
		});
	}
	if(device.onTrackBeatgrid) device.onTrackBeatgrid(track, info);
	for(var chan in device.devices){
		var remote = device.devices[chan];
		if(remote && track.compare(remote.track) && !track.compare(remote.trackBeatgrid)){
			remote.trackBeatgrid = remote.track;
			if(device.onTrackChangeBeatgrid) device.onTrackChangeBeatgrid(remote, track);
		}
	}
}

DJMDevice.prototype.haveWaveformDetail = function haveWaveformDetail(track, info){
	var device = this;
	var trackdata = device.tracks[track] = device.tracks[track] || {track:track};
	if(!info || !info.body){
		trackdata.waveformdetail = null;
		return;
	}
	trackdata.waveformdetail = info.body;
	if(device.onTrackWaveformDetail) device.onTrackWaveformDetail(track, info);
	for(var chan in device.devices){
		var remote = device.devices[chan];
		if(remote && track.compare(remote.track) && !track.compare(remote.trackWaveformDetail)){
			remote.trackWaveformDetail = remote.track;
			if(device.onTrackChangeWaveformDetail) device.onTrackChangeWaveformDetail(remote, track);
		}
	}
}

DJMDevice.prototype.haveWaveformSummary = function haveWaveformSummary(track, info){
	var device = this;
	var trackdata = device.tracks[track] = device.tracks[track] || {track:track};
	if(!info || !info.body){
		trackdata.waveformsummary = null;
		return;
	}
	trackdata.waveformsummary = info.body;
	if(device.onTrackWaveformSummary) device.onTrackWaveformSummary(track, info);
	for(var chan in device.devices){
		var remote = device.devices[chan];
		if(remote && track.compare(remote.track) && !track.compare(remote.trackWaveformSummary)){
			remote.trackWaveformSummary = remote.track;
			if(device.onTrackChangeWaveformSummary) device.onTrackChangeWaveformSummary(remote, track);
		}
	}
}
