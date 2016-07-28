
// TODO:
// Link Info
// Tag List
// Tag List menu including Remove All Items?

var st = require('./dbstruct.js');
var ItemHandshake = st.ItemHandshake;
var ItemHandshake = st.ItemHandshake;
var artBlob = require('fs').readFileSync(__dirname+'/art.jfif');
var showIncoming = true;
var showOutgoing = true;

function handleDBServerConnection(device, socket) {
	console.log('DBServer: New connection at '+socket.localPort);
	var state = socket.state = {};
	state.length = 0;
	state.initialized = 0;
	state.buffer = new Buffer(0); // Hold onto packets while they're incomplete
	state.menus = {}
	function sendItems(items){
		console.log('> DBServer outgoing response');
		socket.write(Buffer.concat(items.map(function(v){
			console.log(formatBuf(v.toBuffer()));
			console.log(v);
			return v.toBuffer();
		})));
	}
	socket.on('data', function(newdata) {
		state.length += newdata.length;
		var data = state.buffer.length ? state.buffer.concat(newdata) : newdata;
		console.log('< DBServer incoming request');
		console.log(formatBuf(data));
		var message = parseMessage(data);
		console.log('  DBServer type='+((message.a<<8)|(message.b<<0)).toString(16));
		var r = message.requestId;
		var type = (message.a<<8)|(message.b);
		assertParsed(data, message);

		if(state.initialized===0){
			// The first packet that comes in on the connection always seems to be the handshake:
			// the same five bytes in both directions, client first
			if(message instanceof ItemHandshake){
				console.log('> DBServer ItemHandshake');
				socket.write(new ItemHandshake().toBuffer());
			}else{
				throw new Error('Invalid handshake');
			}
			state.initialized = 1;
			return;
		}
		// The second packet that comes in seems to be this "hello" packet, the same 0x2a bytes except for the last one
		if(message instanceof ItemHello){
			console.log('  chan='+message.channel);
			// Form the response
			console.log('> DBServer ItemSup');
			sendItems([new ItemSup(device.channel)]);
			return;
		}
		// All of the other requests follow this magic pattern
		var magic_header = new Buffer([0x11, 0x87, 0x23, 0x49, 0xae, 0x11, 0x03, 0x80]);
		if(data.slice(0,8).compare(magic_header)!=0){
			console.error(magic_header);
			console.error(data);
			throw new Error('Invalid magic header');
		}

		// Parse message contents
		if(message instanceof Item){
			var info = parseItem(message, data);
		}else{
			var info = message;
		}
		assertParsed(data, info);

		if(message.a==0x10){
			var affectedMenu = info.affectedMenu;
			console.log('  navigate to device menu');
			var menu = state.menus[affectedMenu] = {};
			menu.method = message.a;
			menu.listing = info.listing; // this is really the second byte of the 'type' field
			menu.playlist = 0; // undefined
			if(menu.listing==0x00){
				menu.items = [
					new Item41(r, 0x81, 0x2, "\ufffaARTIST\ufffb"),
					new Item41(r, 0x90, 0x3, "\ufffaALBUM\ufffb"),
					new Item41(r, 0x83, 0x4, "\ufffaTRACK\ufffb"),
					new Item41(r, 0x8b, 0xc, "\ufffaKEY\ufffb"),
					new Item41(r, 0x84, 0x5, "\ufffaPLAYLIST\ufffb"),
					new Item41(r, 0x95, 0x16, "\ufffaHISTORY\ufffb"),
					new Item41(r, 0x90, 0x16, "\ufffaSEARCH\ufffb"),
					new Item41(r, 0x90, 0x16, "\ufffaHOT CUE BANK\ufffb"),
				];
			}else if(menu.listing==0x02){
				// List all the albums
				menu.items = [
					new Item41(r, 0x04, 0xf42f, "Album"),
				];
			}else if(menu.listing==0x03){
				// List all the artists
				menu.items = [
					new Item41(r, 0x04, 0x1778, "Artist"),
				];
			}else if(menu.listing==0x04){
				// List all the tracks!
				menu.items = [
					new Item41({
						numeric2: 13800,
						numeric: 0x1778, // BPM number
						label: 'Title',
						label2: 'Artist',
						symbol: 0x04, symbol2: 0x07,
						opt7: 0,
						albumArtId: 1234,
						opt9: 1,
						// bit mask seems to control different properties
						// any value in least sig byte seems to grey out and disable the track
						// any value in second-sig byte shows an H-note instead of simply the music note
						// third-sig byte seems to do nothing
						opta: 0,
						// don't know what this does
						optb: 7,
					}),
					new Item41(r, 0x04, 0x1779, "Exactly", 0x0d, 0x35e8),
					new Item41(r, 0x04, 0x177a, "Arisen", 0x0d, 0x35e8),
					new Item41(r, 0x04, 0x177b, "Communication Part One", 0x0d, 0x35e8),
					new Item41(r, 0x04, 0x177c, "Poppiholla (Club Mix)", 0x0d, 0x2ee0),
					new Item41(r, 0x04, 0x177d, "Lost (Dance)", 0x0d, 0x2ee0),
					new Item41(r, 0x04, 0x177e, "Strangers We've Become", 0x0d, 0x2ee0),
					new Item41(r, 0x04, 0x177f, "Every Other Way (Armin van Buuren Remix)", 0x0d, 0x2ee0),
				];
			}else{
				menu.items = [
					new Item41(r, 0x23, 0x01, "selectedItem="+menu.listing.toString(16)),
					new Item41(r, 0x90, 0x02, "\ufffaAlbums\ufffb"),
					new Item41(r, 0x90, 0x04, "\ufffaTracks\ufffb"),
					new Item41(r, 0x90, 0x0c, "\ufffaKey\ufffb"),
					new Item41(r, 0x90, 0x05, "\ufffaPlaylist\ufffb"),
					new Item41(r, 0x90, 0x16, "\ufffaHistory\ufffb"),
				];
			}
			var response_prerequest = new Item4000(r, type, menu.items.length);
			sendItems([response_prerequest]);
			return;
		}

		if(info instanceof Item11){
			var menu = state.menus[info.affectedMenu] = {};
			if(info.playlist==0x40){
				// Trance Collections folder
				menu.items = [
					new Item41(r, 0x23, 1, "Playlist="+info.playlist.toString(16)),
					new Item41(r, 0x08, 0x28, "Trance Uplifting Favorites"),
					new Item41(r, 0x90, 0x10, "B"),
					new Item41(r, 0x90, 0x28, "C"),
					new Item41(r, 0x90, 0x3d, "D"),
					new Item41(r, 0x90, 0x37, "E"),
					new Item41(r, 0x90, 0x37, "F"),
					new Item41(r, 0x90, 0x37, "G"),
					new Item41(r, 0x90, 0x37, "H"),
					new Item41(r, 0x90, 0x37, "I"),
				];
			}else if(info.playlist==0x28){
				// Trance Uplifting Favorites playlist
				menu.items = [
					new Item41(r, 0x04, 0x1778, "Dido", 0x36af, 0x07, 0x0f, 0xde, 0x02, ""),
					new Item41(r, 0x04, 0x1779, "Exactly", 0x35e8, 0x0d, 0x0f, 0xde, 0x02),
					new Item41(r, 0x04, 0x177a, "Arisen", 0x35e8, 0x0d),
					new Item41(r, 0x04, 0x177b, "Communication Part One", 0x35e8, 0x0d),
					new Item41(r, 0x04, 0x177c, "Poppiholla (Club Mix)", 0x2ee0, 0x0d),
					new Item41(r, 0x04, 0x177d, "Lost (Dance)", 0x2ee0, 0x0d),
					new Item41(r, 0x04, 0x177e, "Strangers We've Become", 0x2ee0, 0x0d),
					new Item41(r, 0x04, 0x177f, "Every Other Way (Armin van Buuren Remix)", 0x2ee0, 0x0d),
				];
			}else{
				// Playlists folder
				menu.items = [
					new Item41(r, 0x23, 1, "Playlist="+info.playlist.toString(16)),
					new Item41(r, 0x90, 0x14, "Folder 2"),
					new Item41(r, 0x90, 0x10, "Folder 3"),
					new Item41(r, 0x90, 0x40, "Trance Collections"),
					new Item41(r, 0x90, 0x3d, "Playlist 5"),
					new Item41(r, 0x90, 0x37, "Playlist 6"),
				];
			}
			var response_prerequest = new Item4000(r, type, menu.items.length);
			console.log('  navigate to playlist id='+info.playlist.toString(16)+'');
			sendItems([response_prerequest]);
			return;
		}
		if(info instanceof Item14){
			var affectedMenu = info.args[0].data[1];
			var menu = state.menus[affectedMenu] = {};
			menu.items = [
				new Item41(r, 0xa1, 0, "Default"),
				new Item41(r, 0xa2, 1, "Alphabet"),
				new Item41(r, 0x81, 2, "Artist"),
				new Item41(r, 0x82, 3, "Album"),
				new Item41(r, 0x85, 4, "Tempo"),
				new Item41(r, 0x86, 5, "Rating"),
				new Item41(r, 0x8b, 6, "Key"),
				new Item41(r, 0x92, 7, "Duration"),
			];
			var response_prerequest = new Item4000(r, type, menu.items.length);
			sendItems([response_prerequest]);
			return;
		}
		if(info instanceof Item2002){
			var affectedMenu = info.affectedMenu;
			var menu = state.menus[affectedMenu] = {};
			// Note that the CDJ won't display all of these
			menu.items = [
				new Item41(r, 0x04, 0x1776, "Track Title"),
				new Item41(r, 0x07, 0x0828, "Artist"),
				new Item41(r, 0x02, 0x112, "Album"),
				new Item41(r, 0x0b, 121, ""), //Duration
				new Item41(r, 0x0d, 13800, ""), // Tempo
				new Item41(r, 0x23, 0x1778, ""), // ???
				new Item41(r, 0x0f, 6, "Fm"), // Key field
				new Item41(r, 0x0a, 2, ""), // Rating (n/5 stars)
				new Item41(r, 0x13, 0, "STRING"), // ?
			];
			var response_prerequest = new Item4000(r, type, menu.items.length);
			sendItems([response_prerequest]);
			return;
		}
		if(info instanceof Item2003){
			var response = new Item(r, 0x40, 0, [
				new Kibble11(0x2003),
				new Kibble11(0),
				new Kibble11(artBlob.length),
				Kibble14.blob(artBlob),
			]);
			sendItems([response]);
			return;
		}
		if(info instanceof Item2004){
			var blob = new Buffer([0x02, 0x05, 0x02, 0x05, 0x05, 0x05, 0x03, 0x05,]);
			var response = new Item(r, 0x40, 0, [
				new Kibble11(0x2004),
				new Kibble11(0),
				new Kibble11(blob.length),
				Kibble14.blob(blob),
			]);
			sendItems([response]);
			return;
		}
		if(info instanceof Item2102){
			var affectedMenu = info.affectedMenu;
			var menu = state.menus[affectedMenu] = {};
			menu.items = [
				new Item41(r, 0x04, 1, ""),
				new Item41(r, 0x0b, 0xaa, ""),
				new Item41(r, 0x0d, 0x3a75, ""),
				new Item41(r, 0x23, 0, "Album Label"),
				new Item41(r, 0, 0x2a26, "/data/file.mp3", 0, 0x3ebf0b),
				new Item41(r, 0x2f, 1, ""),
			];
			var response_prerequest = new Item4000(r, type, menu.items.length);
			sendItems([response_prerequest]);
			return;
		}
		if(info instanceof Item2104){
			var response_prerequest = new Item4702(r);
			sendItems([response_prerequest]);
			return;
		}
		if(message.a==0x30){
			var affectedMenu = message.args[0].data[1];
			var offset = message.args[1].uint;
			var limit = message.args[2].uint;
			var menu = state.menus[affectedMenu];
			var menuLabel = menuLabels[affectedMenu] || affectedMenu.toString(16);
			var response = menu.items.slice(offset, offset+limit);
			response.forEach(function(v){ v.requestId = message.requestId; });
			response.unshift(new Item4001(r));
			response.push(new Item42(r));
			console.log('  renderMenu menu='+menuLabel+' offset='+info.offset.toString(16));
			sendItems(response);
			return;
		}
		if(0){
			// Whatever condition causes this "Link Info" menu to show up
			menu.items = [
				new Item41(r, 0x04, 1, "Track"),
				new Item41(r, 0x07, 1, "Artist"),
				new Item41(r, 0x02, 1, "Album"),
				new Item41(r, 0x0b, 9001, ""), // Duration (minutes)
				new Item41(r, 0x0d, 138*100, ""), // 0 or tempo (hundredths of BPM)
				new Item41(r, 0x23, 1, "Comment"),
			];
		}
		if(info instanceof Item3e){
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
		throw new Error('Unknown incoming data/request '+(message.a<<8 | message.b).toString(16));
	});
	socket.on('end', function() {
		console.log('DBServer: Connection closed');
	});
	// start the flow of data, discarding it.
	socket.resume();
}

module.exports.handleDBServerConnection = handleDBServerConnection;
