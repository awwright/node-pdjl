
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

function Item40(r, aaa0, aaaa, bbbb, len){
	var len0 = len>>8;
	var len1 = len & 0xff;
	return new Buffer([
		0x11, 0x87, 0x23, 0x49, 0xae, 0x11, 0x03, 0x80,  r[0], r[1], 0x10, 0x40, aaa0, 0x0f, 0x02, 0x14,
		0x00, 0x00, 0x00, 0x0c, 0x06, 0x06, 0x00, 0x00,  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		0x11, 0x00, 0x00, aaaa, bbbb, 0x11, 0x00, 0x00,  len0, len1,
	]);
}

function Item41(r, aaaa, bbbb, numeric, label, eeee, symbol){
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
	var ccc0 = (numeric>>8) & 0xff;
	var ccc1 = (numeric>>0) & 0xff;
	var dddd = label.length*2 + 2;
	var nnn0 = (label.length+1) >> 8;
	var nnn1 = (label.length+1) & 0xff;
	var buf = new Buffer(0x60+label.length*2);
	buf.fill();
	var tpl = new Buffer([
		0x11, 0x87, 0x23, 0x49, 0xae, 0x11, 0x03, 0x80,  r[0], r[1], 0x10, 0x41, aaaa, 0x0f, bbbb, 0x14,
		0x00, 0x00, 0x00, 0x0c, 0x06, 0x06, 0x06, 0x02,  0x06, 0x02, 0x06, 0x06, 0x06, 0x06, 0x06, 0x06,
		0x11, 0x00, 0x00, 0x00, 0x00, 0x11, 0x00, 0x00,  ccc0, ccc1, 0x11, 0x00, 0x00, 0x00, dddd, 0x26,
		0x00, 0x00, nnn0, nnn1, 0x00, 0x00, 0x11, 0x00,  0x00, 0x00, 0x02, eeee, 0x00, 0x00, 0x00, 0x01,
		0x00, 0x00, 0x11, 0x00, 0x00, 0x00, symb, 0x11,  0x00, 0x00, 0x00, 0x00, 0x11, 0x00, 0x00, 0x00,
		0x00, 0x11, 0x00, 0x00, 0x00, 0x00, 0x11, 0x00,  0x00, 0x00, 0x00, 0x11, 0x00, 0x00, 0x00, 0x00,
	]);
	tpl.copy(buf, 0, 0, 0x34);
	for(var i=0; i<label.length; i++) buf.writeUInt16BE(label.charCodeAt(i)||0, 0x34+i*2);
	tpl.copy(buf, 0x34+label.length*2, 0x34, tpl.length);
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
			console.log(formatBuf(response_hello));
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
		var sourceMedia = data[0x23]; // 2=SD, 3=USB
		console.log('< DBServer type=x'+type.toString(16)+' media='+sourceMedia.toString(16));
		console.log(formatBuf(data));
		// This packet seems to control scrolling information
		if(type==0x10){
			console.log('> DBServer prerequest');
			state.selectedItem = data[0x0c];
			if(data.slice(0x0c, 0x10).compare(Buffer([0x06, 0x0f, 0x04, 0x14]))==0){
				console.log('USB drive');
				// USB drive pre-request
				return;
			}
			if(data.slice(0x0c, 0x10).compare(Buffer([0x00, 0x0f, 0x03, 0x14]))==0){
				// SD card pre-request
				console.log('SD card (1/4)');
				var response_prerequest = Item40(r, 0, data[0x0b], 0, 6);
				console.log(formatBuf(response_prerequest));
				socket.write(response_prerequest);
				return;
			}
			var leng = 1000; // Number of menu items there will be, plus one (maybe)
			var response_prerequest = Item40(r, 0, data[0x0b], 0x02, leng);
			console.log(formatBuf(response_prerequest));
			socket.write(response_prerequest);
			return;
		}
		if(type==0x20){
			console.log('> DBServer pre-request-20 '+data.slice(0x0c, 0x10).toString('hex'));
			if(data.slice(0x0c, 0x10).compare(Buffer([0x06, 0x0f, 0x04, 0x14]))==0){
				// SD card pre-request
				console.log('SD card (3/4)');
				var response_prerequest = Item40(r, 0, data[0x0b], 0x06, 0x01);
				//console.log(formatBuf(response_prerequest));
				socket.write(response_prerequest);
				return;
			}
			console.log('No response? Fatal');
			return;
		}
		if(type==0x30){
			console.log('> DBServer main-request');
			if(data[0x22]==0x01){
				// SD card pre-request
				console.log('SD card (2/4)');
				var response = [
					Item40(r, 0x01, 0x00, 0x01, 0),
					Item41(r, 1, 0x0c, 0x0f, "\ufffa0f\ufffb", 0x26, 0x90),
					Item41(r, 1, 0x0c, 0x10, "\ufffa10\ufffb", 0x26, 0x90),
					Item41(r, 1, 0x0c, 0x11, "\ufffa11\ufffb", 0x26, 0x90),
					Item41(r, 1, 0x0c, 0x12, "\ufffa12\ufffb", 0x26, 0x90),
					Item41(r, 1, 0x0c, 0x13, "\ufffa13\ufffb", 0x26, 0x90),
					Item41(r, 1, 0x0c, 0x14, "\ufffa14\ufffb", 0x26, 0x90),
					Item42(r),
				];
				//console.log(response.map(formatBuf).join(''));
				socket.write(Buffer.concat(response));
				return;
			}
			if(data[0x22]==0x02){
				// SD card pre-request
				console.log('SD card subdir (4/4)');
				var response = [
					Item40(r, 0x01, 0x00, 0x01, 0),
					Item41(r, 1, 0x0c, 0x11, "Submenu 0x"+(state.selectedItem.toString(16)), 0x26, 0x90),
					Item42(r),
				];
				//console.log(response.map(formatBuf).join(''));
				socket.write(Buffer.concat(response));
				return;
			}
			var response = [
				Item40(r, 0x01, 0, 1, 0),
				Item41(r, 1, 0x0c, 1, "Track", 0x26, 0x04),
				Item41(r, 1, 0x0c, 1, "Artist", 0x26, 0x07),
				Item41(r, 1, 0x0c, 1, "Album", 0x26, 0x02),
				Item41(r, 1, 0x0c, 9001, "", 0x26, 0x0b), // Duration (minutes)
				Item41(r, 1, 0x0c, 138*100, "", 0x26, 0x0d), // 0 or tempo (hundredths of BPM)
				Item41(r, 1, 0x0c, 1, "", 0x26, 0x23),
				Item42(r),
			];
			console.log(response.map(formatBuf).join(''));
			socket.write(Buffer.concat(response));
			return;
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


