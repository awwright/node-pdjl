
// TODO:
// Link Info
// Tag List
// Tag List menu including Remove All Items?

function formatBuf(b){
	var x = "";
	for(var i=0; i<b.length; ){
		x += b.slice(i,i+1).toString('hex');
		if(++i==b.length) break;
		else if(i%16==0){
			x+="   ";
			for(var j=16; j>0; j--) x += (b[i-j]>=0x20&&b[i-j]<0x80) ? String.fromCharCode(b[i-j]) : '.';
			x+="\n";
		}
		else if(i%8==0) x+="  ";
		else x+=" ";
	}
	return x+"\n";
}

function assertParsed(data, info){
	var backwards = info.toBuffer();
	if(backwards.compare(data)){
		console.error('Incoming/generated item mismatch!');
		console.error(formatBuf(data));
		console.error(formatBuf(backwards));
		throw new Error('Incoming/generated mismatch');
	}
}

function Item10(data){
	if(data instanceof Buffer){
		this.length = 0x2f;
		this.method = 0x10;
		this.requestId = (data[0x08]<<8) + (data[0x09]);
		this.affectedMenu = data[0x22];
		this.submenuItems = data[0x16]; // Seems to be set to 0x06 if the request is a submenu
		this.listing = data[0x0c];
		this.playlist = 0; // undefined
	}else{
		for(var n in data) this[n]=data;
	}
}
Item10.prototype.toBuffer = function toBuffer(){
	var _x08 = (this.requestId>>8) & 0xff;
	var _x09 = (this.requestId>>0) & 0xff;
	var _x16 = this.submenuItems;
	var _x22 = this.affectedMenu;
	return new Buffer([
		0x11, 0x87, 0x23, 0x49, 0xae, 0x11, 0x03, 0x80,  _x08, _x09, 0x10, 0x10, 0x00, 0x0f, 0x03, 0x14,
		0x00, 0x00, 0x00, 0x0c, 0x06, 0x06, _x16, 0x00,  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		0x11, 0x03, _x22, 0x04, 0x01, 0x11, 0x00, 0x00,  0x00, 0x00, 0x11, 0x00, 0xff, 0xff, 0xff,
	]);
}

function Item11(data){
	if(data instanceof Buffer){
		this.length = 0x2f;
		this.method = 0x10;
		this.requestId = (data[0x08]<<8) + (data[0x09]);
		this._x16 = data[0x16];
		this._x17 = data[0x17];
		this.affectedMenu = data[0x22];
		this.playlist = (data[0x2d]<<8) + data[0x2e];
		this._x33 = data[0x33];
	}else{
		for(var n in data) this[n]=data;
	}
}
Item11.prototype.toBuffer = function toBuffer(){
	var _x08 = (this.requestId>>8) & 0xff;
	var _x09 = (this.requestId>>0) & 0xff;
	var _x16 = this._x16; // This is set for the device full-menu; not sort-popout menu
	var _x17 = this._x17; // This is set for the device full-menu; not sort-popout menu
	var _x22 = this.affectedMenu;
	var _x2d = (this.playlist>>8) & 0xff;
	var _x2e = (this.playlist>>0) & 0xff;
	var _x33 = this._x33;
	return new Buffer([
		0x11, 0x87, 0x23, 0x49, 0xae, 0x11, 0x03, 0x80,  _x08, _x09, 0x10, 0x11, 0x05, 0x0f, 0x04, 0x14,
		0x00, 0x00, 0x00, 0x0c, 0x06, 0x06, _x16, _x17,  0x00, 0x00, 0x00, 0x00, 0x00, _x2d, _x2e, 0x00,
		0x11, 0x03, _x22, 0x04, 0x01, 0x11, 0x00, 0x00,  0x00, 0x00, 0x11, 0x00, 0x00, 0x00, 0x00, 0x11,
		0x00, 0x00, 0x00, _x33,
	]);
}

// This is sent to request the 'Sort' or maybe another pop-up menu
function Item14(data){
	if(data instanceof Buffer){
		this.length = 0x2f;
		this.method = 0x10;
		this.requestId = (data[0x08]<<8) + (data[0x09]);
		this.affectedMenu = data[0x22];
	}else{
		for(var n in data) this[n]=data;
	}
}
Item14.prototype.toBuffer = function toBuffer(){
	var _x08 = (this.requestId>>8) & 0xff;
	var _x09 = (this.requestId>>0) & 0xff;
	var _x22 = this.affectedMenu;
	return new Buffer([
		0x11, 0x87, 0x23, 0x49, 0xae, 0x11, 0x03, 0x80,  _x08, _x09, 0x10, 0x14, 0x00, 0x0f, 0x03, 0x14,
		0x00, 0x00, 0x00, 0x0c, 0x06, 0x06, 0x06, 0x00,  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		0x11, 0x03, _x22, 0x04, 0x01, 0x11, 0x00, 0x00,  0x00, 0x00, 0x11, 0x00, 0x00, 0x10, 0x04,
	]);
}

function Item22(data){
}
Item22.prototype.toBuffer = function toBuffer(){
}

// This is sent to request that a particular menu be rendered out to the client
function Item30(data){
	if(data instanceof Buffer){
		this.length = 0x3e;
		this.method = 0x30;
		this.requestId = (data[0x08]<<8) + (data[0x09]);
		this._x16 = data[0x16];
		this._x17 = data[0x17];
		this.affectedMenu = data[0x22];
		this.offset = (data[0x28]<<8) + (data[0x29]<<0);
		this._x2e = data[0x2e];
		this._x38 = data[0x38];
		this._x3d = data[0x3d];
	}else{
		for(var n in data) this[n]=data;
	}
}
Item30.prototype.toBuffer = function toBuffer(){
	var _x08 = (this.requestId>>8) & 0xff;
	var _x09 = (this.requestId>>0) & 0xff;
	var _x16 = this._x16; // This is set for the device full-menu; not sort-popout menu
	var _x17 = this._x17; // This is set for the device full-menu; not sort-popout menu
	var _x22 = this.affectedMenu;
	var _x28 = (this.offset>>8) & 0xff;
	var _x29 = (this.offset>>0) & 0xff;
	var _x2e = this._x2e;
	var _x38 = this._x38;
	var _x3d = this._x3d;
	return new Buffer([
		0x11, 0x87, 0x23, 0x49, 0xae, 0x11, 0x03, 0x80,  _x08, _x09, 0x10, 0x30, 0x00, 0x0f, 0x06, 0x14,
		0x00, 0x00, 0x00, 0x0c, 0x06, 0x06, _x16, _x17,  0x06, 0x06, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		0x11, 0x03, _x22, 0x04, 0x01, 0x11, 0x00, 0x00,  _x28, _x29, 0x11, 0x00, 0x00, 0x00, _x2e, 0x11,
		0x00, 0x00, 0x00, 0x00, 0x11, 0x00, 0x00, 0x00,  _x38, 0x11, 0x00, 0x00, 0x00, _x3d,
	]);
}

artBlob = require('fs').readFileSync('./art.jfif');
var showIncoming = true;
var showOutgoing = true;

function Item40(r, responseBody, aaaa, bbbb, len){
	// responseBody seems to indicate if there will be additional 41 messages and a trailing 42 message
	// aaaa seems to list whichever "method" was used by the request in byte 0xb except for 0x30 which is 0
	var x0xx = responseBody;
	var len0 = len>>8;
	var len1 = len & 0xff;
	return new Buffer([
		0x11, 0x87, 0x23, 0x49, 0xae, 0x11, 0x03, 0x80,  r[0], r[1], 0x10, 0x40, x0xx, 0x0f, 0x02, 0x14,
		0x00, 0x00, 0x00, 0x0c, 0x06, 0x06, 0x00, 0x00,  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		0x11, 0x00, 0x00, aaaa, bbbb, 0x11, 0x00, 0x00,  len0, len1,
	]);
}

function Item41(r, aaaa, bbbb, numeric, bpm, label, eeee, symbol, ffff, gggg, hhhh, iiii, sticky){
	// Some defaults
	ffff = ffff || 0; // Icon for second column
	gggg = gggg || 0;
	hhhh = hhhh || 0;
	iiii = iiii || 0;
	sticky = sticky || '';

	// 00 = nothing
	// 01 = folder
	// 02 = disc (album title)
	// 03 = disc (same as above?)
	// 04 = music note (track title)
	// 05 = music note (same as above?)
	// 06 = disc in folder
	// 07 = person
	// 08 = stack of something
	// 09 = stack of something
	// 0a = 1/5 stars (numeric)
	// 0b = duration (numeric)
	// 0c = Eighth note with "C" (string)
	// 0d = BPM (numeric)
	// 0e = disc inside sleeve?
	// 0f = key: sharp/flat icon (string)
	// 10 = bps (numeric)
	// 11 = pie and calendar (numeric)
	// 12 = file (string)
	// 13 = circle
	// 14 = magenta circle
	// 15 = red circle
	// 16 = orange circle
	// 17 = yellow circle
	// 18 = green circle
	// 19 = cyan circle
	// 1a = blue circle
	// 1b = violet circle
	// 1c = circle
	// 1d =
	// 1e =
	// 1f =
	// 20 = circle
	// 23 = speech bubble
	// 24 = stack of stuff
	// 28 = person with star head
	// 30 = eighth note with "H"
	// 31 = red H-check hot cue (string)
	// 32 = plain H-check
	// 33 = orange flat-sharp symbol
	// 34 = green flat-sharp
	// 35 = nothing
	// ef = nothing
	// ff = nothing
	var symb = symbol;

	// For some menu items, this provides a numeric argument e.g. beats per 100 minutes, or duration in minutes.
	// For others, this specifies which submenu item it links to
	// 00 = always shows empty
	// 01 =
	// 02 = Mount/Artists
	// 03 = Mount/Albums
	// 04 = Mount/Tracks
	// 05 = (x11) Mount/Playlists
	// 06 = (x10-x30 request for submenu)
	// 07 = (x10-x30 request for submenu)
	// 08 = (x10-x30 request for submenu)
	// 09 = (x16 request)
	// 0a = (x10-x30 request for 0x0a)
	// 0b = (x13 request)
	// 0c = (x10-x30 request for 0x14)
	// 0d = (no request, blank)
	// 0e = (0x13 request)
	// 0f = (x10-x30 request for 0x0d)
	// 10 = (no request, shows "EMPTY")
	// 11 = (x20-x30 request)
	// 12 = Search, no submenu requests, shows blank submenu
	var bbcc = (bpm>>8) & 0xff;
	var bbdd = (bpm>>0) & 0xff;
	var ccc0 = (numeric>>8) & 0xff;
	var ccc1 = (numeric>>0) & 0xff;
	var size = label.length*2 + 2;
	var len0 = (label.length+1) >> 8;
	var len1 = (label.length+1) & 0xff;
	var lem0 = (sticky.length+1) >> 8;
	var lem1 = (sticky.length+1) & 0xff;
	var buf = new Buffer(0x60+label.length*2);
	buf.fill();
	var tpl = new Buffer([
		0x11, 0x87, 0x23, 0x49, 0xae, 0x11, 0x03, 0x80,  r[0], r[1], 0x10, 0x41, aaaa, 0x0f, bbbb, 0x14,
		0x00, 0x00, 0x00, 0x0c, 0x06, 0x06, 0x06, 0x02,  0x06, 0x02, 0x06, 0x06, 0x06, 0x06, 0x06, 0x06,
		0x11, 0x00, 0x00, bbcc, bbdd, 0x11, 0x00, 0x00,  ccc0, ccc1, 0x11, 0x00, 0x00, 0x00, size, 0x26,
		0x00, 0x00, len0, len1, 0x00, 0x00, 0x11, 0x00,  0x00, 0x00, 0x02, eeee, 0x00, 0x00, lem0, lem1,
		0x00, 0x00, 0x11, 0x00, 0x00, ffff, symb, 0x11,  0x00, 0x00, 0x00, 0x00, 0x11, 0x00, 0x00, gggg,
		hhhh, 0x11, 0x00, 0x00, 0x00, iiii, 0x11, 0x00,  0x00, 0x00, 0x00, 0x11, 0x00, 0x00, 0x00, 0x00,
	]);
	// Write first string
	tpl.copy(buf, 0, 0, 0x34);
	for(var i=0; i<label.length; i++) buf.writeUInt16BE(label.charCodeAt(i)||0, 0x34+i*2);
	// Write second string
	var start = 0x34+label.length*2;
	tpl.copy(buf, start, 0x34, 0x40);
	for(var i=0; i<sticky.length; i++) buf.writeUInt16BE(sticky.charCodeAt(i)||0, start+i*2+0xc);
	// Write to end
	tpl.copy(buf, start+0xc+sticky.length*2, 0x40, 0x60);
	return buf;
}

function Item42(r){
	var b = new Buffer([
		0x11, 0x87, 0x23, 0x49, 0xae, 0x11, 0x03, 0x80,
		r[0], r[1], 0x10, 0x42, 0x01, 0x0f, 0x00, 0x14,
		0x00, 0x00, 0x00, 0x0c, 0x00, 0x00, 0x00, 0x00,
		0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
	]);
	return b;
}

function handleDBServerConnection(device, socket) {
	console.log('NEW CONNECTION '+socket.localPort);
	var state = socket.state = {};
	state.length = 0;
	state.initialized = 0;
	state.buffer = new Buffer(0); // Hold onto packets while they're incomplete
	state.menus = {}
	socket.on('data', function(newdata) {
		state.length += newdata.length;
		var data = state.buffer.length ? state.buffer.concat(newdata) : newdata;
		// The first packet that comes in on the connection always seems to be the handshake:
		// the same five bytes in both directions, client first
		var magic_handshake = new Buffer([0x11, 0x00, 0x00, 0x00, 0x01]);
		if(state.initialized===0){
			if(data.compare(magic_handshake)!=0){
				console.error(magic_handshake);
				console.error(data);
				throw new Error('Connection init handshake: Invalid handshake');
			}
			console.log('< DBServer handshake');
			// This 'Hello' always seems to be the same five bytes, in both directions: 0x11.00.00.00.01
			socket.write(magic_handshake);
			state.initialized = 1;
			return;
		}
		// The second packet that comes in seems to be this "hello" packet, the same 0x2a bytes except for the last one
		var incoming_hello = new Buffer([ 0x11, 0x87, 0x23, 0x49, 0xae, 0x11, 0xff, 0xff ]);
		if(data.slice(0,8).compare(incoming_hello)==0){
			var incoming_hello_chan = data[0x24];
			console.log('< hello chan='+incoming_hello_chan);
			console.log(formatBuf(data));
			// Form the response
			console.log('> no I do not like your hat');
			var chan = device.channel;
			var response_hello = new Buffer([
				0x11, 0x87, 0x23, 0x49, 0xae, 0x11, 0xff, 0xff,
				0xff, 0xfe, 0x10, 0x40, 0x00, 0x0f, 0x02, 0x14,
				0x00, 0x00, 0x00, 0x0c, 0x06, 0x06, 0x00, 0x00,
				0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
				0x11, 0x00, 0x00, 0x00, 0x00, 0x11, 0x00, 0x00,
				0x00, chan ]);
			if(showOutgoing) console.log(formatBuf(response_hello));
			socket.write(response_hello);
			return;
		}
		// All of the other requests follow this magic pattern
		var magic_header = new Buffer([0x11, 0x87, 0x23, 0x49, 0xae, 0x11, 0x03, 0x80]);
		if(data.slice(0,8).compare(magic_header)!=0){
			console.error(magic_header);
			console.error(data);
			throw new Error('Invalid magic header');
		}
		var r = data.slice(0x8, 0x8+2); // Request ID
		var type = data[0xb]; // seems to be 0x{10,20,30,40,41,42}
		var sourceMedia = data[0x23] || 0xff; // 2=SD, 3=USB
		console.log('< DBServer type=x'+type.toString(16)+' media='+sourceMedia.toString(16));
		console.log(formatBuf(data));
		// This packet seems to control scrolling information
		if(type==0x00){
			console.log('< DBServer: do what now?');
			return;
		}
		if(type==0x10){
			console.log('> DBServer: navigate to device menu');
			var info = new Item10(data);
			// Well this is causing no end of problems for my theories
			//assertParsed(data, info);
			console.log(info);
			var menu = state.menus[info.affectedMenu] = {};
			menu.method = type;
			menu.listing = info.listing;
			menu.playlist = 0; // undefined
			if(menu.listing==0x00){
				menu.items = [
					Item41(r, 1, 0x0c, 0x03, 0, "\ufffaArtists\ufffb", 0x26, 0x90),
					Item41(r, 1, 0x0c, 0x02, 0, "\ufffaAlbums\ufffb", 0x26, 0x90),
					Item41(r, 1, 0x0c, 0x04, 0, "\ufffaTracks\ufffb", 0x26, 0x83),
					Item41(r, 1, 0x0c, 0x0c, 0, "\ufffaKey\ufffb", 0x26, 0x90),
					Item41(r, 1, 0x0c, 0x05, 0, "\ufffaPlaylist\ufffb", 0x26, 0x90),
					Item41(r, 1, 0x0c, 0x16, 0, "\ufffaHistory\ufffb", 0x26, 0x90),
				];
			}else if(menu.listing==0x04){
				// List all the tracks!
				menu.items = [
					Item41(r, 1, 0x0c, 0x1778, 0x36af, "Dido", 0x26, 0x04, 0x07, 0x0f, 0xde, 0x02, ""),
					Item41(r, 1, 0x0c, 0x1779, 0x35e8, "Exactly", 0x26, 0x04, 0x0d, 0x0f, 0xde, 0x02),
					Item41(r, 1, 0x0c, 0x177a, 0x35e8, "Arisen", 0x26, 0x04, 0x0d),
					Item41(r, 1, 0x0c, 0x177b, 0x35e8, "Communication Part One", 0x26, 0x04, 0x0d),
					Item41(r, 1, 0x0c, 0x177c, 0x2ee0, "Poppiholla (Club Mix)", 0x26, 0x04, 0x0d),
					Item41(r, 1, 0x0c, 0x177d, 0x2ee0, "Lost (Dance)", 0x26, 0x04, 0x0d),
					Item41(r, 1, 0x0c, 0x177e, 0x2ee0, "Strangers We've Become", 0x26, 0x04, 0x0d),
					Item41(r, 1, 0x0c, 0x177f, 0x2ee0, "Every Other Way (Armin van Buuren Remix)", 0x26, 0x04, 0x0d),
				];
			}else{
				menu.items = [
					Item41(r, 1, 0x0c, 0x01, 0, "selectedItem="+menu.listing.toString(16), 0x26, 0x23),
					Item41(r, 1, 0x0c, 0x02, 0, "\ufffaAlbums\ufffb", 0x26, 0x90),
					Item41(r, 1, 0x0c, 0x04, 0, "\ufffaTracks\ufffb", 0x26, 0x90),
					Item41(r, 1, 0x0c, 0x0c, 0, "\ufffaKey\ufffb", 0x26, 0x90),
					Item41(r, 1, 0x0c, 0x05, 0, "\ufffaPlaylist\ufffb", 0x26, 0x90),
					Item41(r, 1, 0x0c, 0x16, 0, "\ufffaHistory\ufffb", 0x26, 0x90),
				];
			}
			var response_prerequest = Item40(r, 0, type, 0x02, menu.items.length);
			if(showOutgoing) console.log(formatBuf(response_prerequest));
			socket.write(response_prerequest);
			return;
		}
		if(type==0x11){
			var info = new Item11(data);
			assertParsed(data, info);
			console.log(info);
			var menu = state.menus[info.affectedMenu] = {};
			if(info.playlist==0x40){
				// Trance Collections folder
				menu.items = [
					Item41(r, 1, 0x0c, 1, 0, "Playlist="+info.playlist.toString(16), 0x26, 0x23),
					Item41(r, 1, 0x0c, 0x28, 0, "Trance Uplifting Favorites", 0x26, 0x08),
					Item41(r, 1, 0x0c, 0x10, 0, "B", 0x26, 0x90),
					Item41(r, 1, 0x0c, 0x28, 0, "C", 0x26, 0x90),
					Item41(r, 1, 0x0c, 0x3d, 0, "D", 0x26, 0x90),
					Item41(r, 1, 0x0c, 0x37, 0, "E", 0x26, 0x90),
					Item41(r, 1, 0x0c, 0x37, 0, "F", 0x26, 0x90),
					Item41(r, 1, 0x0c, 0x37, 0, "G", 0x26, 0x90),
					Item41(r, 1, 0x0c, 0x37, 0, "H", 0x26, 0x90),
					Item41(r, 1, 0x0c, 0x37, 0, "I", 0x26, 0x90),
				];
			}else if(info.playlist==0x28){
				// Trance Uplifting Favorites playlist
				menu.items = [
					Item41(r, 1, 0x0c, 0x1778, 0x36af, "Dido", 0x26, 0x04, 0x07, 0x0f, 0xde, 0x02, ""),
					Item41(r, 1, 0x0c, 0x1779, 0x35e8, "Exactly", 0x26, 0x04, 0x0d, 0x0f, 0xde, 0x02),
					Item41(r, 1, 0x0c, 0x177a, 0x35e8, "Arisen", 0x26, 0x04, 0x0d),
					Item41(r, 1, 0x0c, 0x177b, 0x35e8, "Communication Part One", 0x26, 0x04, 0x0d),
					Item41(r, 1, 0x0c, 0x177c, 0x2ee0, "Poppiholla (Club Mix)", 0x26, 0x04, 0x0d),
					Item41(r, 1, 0x0c, 0x177d, 0x2ee0, "Lost (Dance)", 0x26, 0x04, 0x0d),
					Item41(r, 1, 0x0c, 0x177e, 0x2ee0, "Strangers We've Become", 0x26, 0x04, 0x0d),
					Item41(r, 1, 0x0c, 0x177f, 0x2ee0, "Every Other Way (Armin van Buuren Remix)", 0x26, 0x04, 0x0d),
				];
			}else{
				// Playlists folder
				menu.items = [
					Item41(r, 1, 0x0c, 1, 0, "Playlist="+info.playlist.toString(16), 0x26, 0x23),
					Item41(r, 1, 0x0c, 0x14, 0, "Folder 2", 0x26, 0x90),
					Item41(r, 1, 0x0c, 0x10, 0, "Folder 3", 0x26, 0x90),
					Item41(r, 1, 0x0c, 0x40, 0, "Trance Collections", 0x26, 0x90),
					Item41(r, 1, 0x0c, 0x3d, 0, "Playlist 5", 0x26, 0x90),
					Item41(r, 1, 0x0c, 0x37, 0, "Playlist 6", 0x26, 0x90),
				];
			}
			console.log('> DBServer navigate to playlist id='+info.playlist.toString(16)+'');
			var response_prerequest = Item40(r, 0, type, 0x05, menu.items.length);
			if(showOutgoing) console.log(formatBuf(response_prerequest));
			socket.write(response_prerequest);
			return;
		}
		if(type==0x14){
			console.log('> DBServer open sort menu');
			var info = new Item14(data);
			assertParsed(data, info);
			console.log(info);
			var menu = state.menus[info.affectedMenu] = {};
			menu.items = [
				Item41(r, 1, 0x0c, 0, 0, "Default", 0x26, 0xa1),
				Item41(r, 1, 0x0c, 1, 0, "Alphabet", 0x26, 0xa2),
				Item41(r, 1, 0x0c, 2, 0, "Artist", 0x26, 0x81),
				Item41(r, 1, 0x0c, 3, 0, "Album", 0x26, 0x82),
				Item41(r, 1, 0x0c, 4, 0, "Tempo", 0x26, 0x85),
				Item41(r, 1, 0x0c, 5, 0, "Rating", 0x26, 0x86),
				Item41(r, 1, 0x0c, 6, 0, "Key", 0x26, 0x8b),
				Item41(r, 1, 0x0c, 7, 0, "Duration", 0x26, 0x92),
			];
			var response_prerequest = Item40(r, 0, type, 0x00, menu.items);
			if(showOutgoing) console.log(formatBuf(response_prerequest));
			socket.write(response_prerequest);
			return;
		}
		if(type==0x20){
			var affectedMenu = data[0x22];
			var menu = state.menus[affectedMenu] = {};
			menu.method = type;
			menu.listing = data[0x0c];
			console.log('> DBServer navigate to tracks listing='+menu.listing.toString(16));
			menu.items = [
				Item41(r, 1, 0x0c, 1, 0, "x20", 0x26, 0x23),
				Item41(r, 1, 0x0c, 0x14, 0, "Folder 2", 0x26, 0x90),
				Item41(r, 1, 0x0c, 0x10, 0, "Folder 3", 0x26, 0x90),
				Item41(r, 1, 0x0c, 0x2a, 0, "Playlist 4", 0x26, 0x90),
				Item41(r, 1, 0x0c, 0x3d, 0, "Playlist 5", 0x26, 0x90),
				Item41(r, 1, 0x0c, 0x37, 0, "Playlist 6", 0x26, 0x90),
			];
			var response_prerequest = Item40(r, 0, type, 0x06, menu.items.length);
			if(showOutgoing) console.log(formatBuf(response_prerequest));
			socket.write(response_prerequest);
			return;
		}
		if(type==0x30){
			var info = new Item30(data);
			assertParsed(data, info);
			console.log(info);
			var menuLabels = {
				1: 'mainmenu',
				2: 'submenu',
				5: 'sortmenu',
			}
			var menu = state.menus[info.affectedMenu];
			var menuLabel = menuLabels[info.affectedMenu] || info.affectedMenu.toString(16);
			console.log('> DBServer renderMenu menu='+menuLabel+' offset='+info.offset.toString(16));
			var response = menu.items.slice(info.offset, info.offset+6);
			response.unshift(Item40(r, 0x01, 0x00, 0x01, 0));
			response.push(Item42(r));
			if(showOutgoing) console.log(response.map(formatBuf).join(''));
			socket.write(Buffer.concat(response));
			return;
		}
		if(0){
			// Whatever condition causes this "Link Info" menu to show up
			menu.items = [
				Item41(r, 1, 0x0c, 1, 0, "Track", 0x26, 0x04),
				Item41(r, 1, 0x0c, 1, 0, "Artist", 0x26, 0x07),
				Item41(r, 1, 0x0c, 1, 0, "Album", 0x26, 0x02),
				Item41(r, 1, 0x0c, 9001, 0, "", 0x26, 0x0b), // Duration (minutes)
				Item41(r, 1, 0x0c, 138*100, 0, "", 0x26, 0x0d), // 0 or tempo (hundredths of BPM)
				Item41(r, 1, 0x0c, 1, 0, "Comment", 0x26, 0x23),
			];
		}
		if(type==0x3e){
			console.log('> DBServer usb-query');
			var response = Buffer([
				0x11, 0x87, 0x23, 0x49, 0xae, 0x11, 0x03, 0x80,  0x00, 0x47, 0x10, 0x4b, 0x02, 0x0f, 0x04, 0x14,
				0x00, 0x00, 0x00, 0x0c, 0x06, 0x06, 0x06, 0x02,  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
				0x11, 0x00, 0x00, 0x3e, 0x03, 0x11, 0x00, 0x00,  0x00, 0x00, 0x11, 0x00, 0x00, 0x00, 0x02, 0x26,
				0x00, 0x00, 0x00, 0x01, 0x00, 0x00,
			]);
			console.log(formatBuf(response));
			socket.write(response);
			return;
		}
		if(type==0x40){
			console.log('> DBServer album art request');
			var len0 = (artBlob.length>>8) & 0xff;
			var len1 = (artBlob.length>>0) & 0xff;
			var response = Buffer([
				0x11, 0x87, 0x23, 0x49, 0xae, 0x11, 0x03, 0x80,  0x0f, 0xc2, 0x10, 0x40, 0x02, 0x0f, 0x04, 0x14,
				0x00, 0x00, 0x00, 0x0c, 0x06, 0x06, 0x06, 0x03,  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
				0x11, 0x00, 0x00, 0x20, 0x03, 0x11, 0x00, 0x00,  0x00, 0x00, 0x11, 0x00, 0x00, 0x0a, 0x51, 0x14,
				0x00, 0x00, len0, len1
			]).concat(artBlob);
			//console.log(formatBuf(response));
			socket.write(response);
			return;
		}
		throw new Error('Unknown incoming data/request '+type.toString(16));
	});
	socket.on('end', function() {
		console.log('Connection closed');
	});
	// start the flow of data, discarding it.
	socket.resume();
}

module.exports.handleDBServerConnection = handleDBServerConnection;

function DBServer(){
	// So what now?
}

// Eight bytes magic
DBServer.magic = [0x11, 0x87, 0x23, 0x49, 0xae, 0x11, 0x03, 0x80];
// Then two bytes request id
// Byte 0x10
// Byte message type
// Remainder packet body?


