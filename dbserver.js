
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

function Item22(r){
	return new Buffer([
		0x11, 0x87, 0x23, 0x49, 0xae, 0x11, 0x03, 0x80,
		r[0], r[1], 0x10, 0x22, // to be completed
	]);
}

artBlob = require('fs').readFileSync('./art.jfif');
var showIncoming = true;
var showOutgoing = true;

function Item40(r, aaa0, aaaa, bbbb, len){
	// aaa0 seems to list whichever "method" was used by the request -- byte 0xb
	var len0 = len>>8;
	var len1 = len & 0xff;
	return new Buffer([
		0x11, 0x87, 0x23, 0x49, 0xae, 0x11, 0x03, 0x80,  r[0], r[1], 0x10, 0x40, aaa0, 0x0f, 0x02, 0x14,
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
	state.menuItems = [];
	state.menus = {1:{}, 2:{}}
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
			state.selectedMethod = type;
			state.selectedItem = data[0x0c];
			state.selectedPlaylist = 0; // undefined
			if(state.selectedItem==0x00){
				state.menuItems = [
					Item41(r, 1, 0x0c, 0x03, 0, "\ufffaArtists\ufffb", 0x26, 0x90),
					Item41(r, 1, 0x0c, 0x02, 0, "\ufffaAlbums\ufffb", 0x26, 0x90),
					Item41(r, 1, 0x0c, 0x04, 0, "\ufffaTracks\ufffb", 0x26, 0x90),
					Item41(r, 1, 0x0c, 0x0c, 0, "\ufffaKey\ufffb", 0x26, 0x90),
					Item41(r, 1, 0x0c, 0x05, 0, "\ufffaPlaylist\ufffb", 0x26, 0x90),
					Item41(r, 1, 0x0c, 0x16, 0, "\ufffaHistory\ufffb", 0x26, 0x90),
				];
			}else{
				state.menuItems = [
					Item41(r, 1, 0x0c, 0x01, 0, "selectedItem="+state.selectedItem.toString(16), 0x26, 0x23),
					Item41(r, 1, 0x0c, 0x02, 0, "\ufffaAlbums\ufffb", 0x26, 0x90),
					Item41(r, 1, 0x0c, 0x04, 0, "\ufffaTracks\ufffb", 0x26, 0x90),
					Item41(r, 1, 0x0c, 0x0c, 0, "\ufffaKey\ufffb", 0x26, 0x90),
					Item41(r, 1, 0x0c, 0x05, 0, "\ufffaPlaylist\ufffb", 0x26, 0x90),
					Item41(r, 1, 0x0c, 0x16, 0, "\ufffaHistory\ufffb", 0x26, 0x90),
				];
			}
			var response_prerequest = Item40(r, 0, data[0x0b], 0x02, state.menuItems.length);
			if(showOutgoing) console.log(formatBuf(response_prerequest));
			socket.write(response_prerequest);
			return;
		}
		if(type==0x11){
			var affectedMenu = data[0x22];
			state.selectedMethod = type;
			state.selectedItem = data[0x0c];
			state.selectedPlaylist = (data[0x2d]<<8) + data[0x2e];
			if(state.selectedPlaylist==0x40){
				// Trance Collections folder
				state.menuItems = [
					Item41(r, 1, 0x0c, 1, 0, "Playlist="+state.selectedPlaylist.toString(16), 0x26, 0x23),
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
			}else if(state.selectedPlaylist==0x28){
				// Trance Uplifting Favorites playlist
				state.menuItems = [
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
				state.menuItems = [
					Item41(r, 1, 0x0c, 1, 0, "Playlist="+state.selectedPlaylist.toString(16), 0x26, 0x23),
					Item41(r, 1, 0x0c, 0x14, 0, "Folder 2", 0x26, 0x90),
					Item41(r, 1, 0x0c, 0x10, 0, "Folder 3", 0x26, 0x90),
					Item41(r, 1, 0x0c, 0x40, 0, "Trance Collections", 0x26, 0x90),
					Item41(r, 1, 0x0c, 0x3d, 0, "Playlist 5", 0x26, 0x90),
					Item41(r, 1, 0x0c, 0x37, 0, "Playlist 6", 0x26, 0x90),
				];
			}
			console.log('> DBServer navigate to playlist id='+state.selectedPlaylist.toString(16)+'');
			var response_prerequest = Item40(r, 0, data[0x0b], 0x05, state.menuItems.length);
			if(showOutgoing) console.log(formatBuf(response_prerequest));
			socket.write(response_prerequest);
			return;
		}
		if(type==0x20){
			console.log('> DBServer navigate to tracks menu='+state.selectedItem.toString(16));
			state.selectedMethod = type;
			state.selectedItem = data[0x0c];
			state.menuItems = [
				Item41(r, 1, 0x0c, 1, 0, "x20", 0x26, 0x23),
				Item41(r, 1, 0x0c, 0x14, 0, "Folder 2", 0x26, 0x90),
				Item41(r, 1, 0x0c, 0x10, 0, "Folder 3", 0x26, 0x90),
				Item41(r, 1, 0x0c, 0x2a, 0, "Playlist 4", 0x26, 0x90),
				Item41(r, 1, 0x0c, 0x3d, 0, "Playlist 5", 0x26, 0x90),
				Item41(r, 1, 0x0c, 0x37, 0, "Playlist 6", 0x26, 0x90),
			];
			var response_prerequest = Item40(r, 0, data[0x0b], 0x06, state.menuItems.length);
			if(showOutgoing) console.log(formatBuf(response_prerequest));
			socket.write(response_prerequest);
			return;
		}
		if(type==0x30){
			var offset = (data[0x28]<<8) + (data[0x29]<<0);
			console.log('0x38 = '+data.slice(0x38, 0x40).toString('hex'));
			console.log('> DBServer renderMenu offset='+offset.toString(16));
			if(data[0x22]==0x01){
				console.log('render main menu');
			}else if(data[0x22]==0x02){
				console.log('render submenu');
			}
			var response = state.menuItems.slice(offset, offset+6);
			response.unshift(Item40(r, 0x01, 0x00, 0x01, 0));
			response.push(Item42(r));
			if(showOutgoing) console.log(response.map(formatBuf).join(''));
			socket.write(Buffer.concat(response));
			return;
		}
		if(0){
			// Whatever condition causes this "Link Info" menu to show up
			state.menuItems = [
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


