
// TODO:
// Link Info
// Tag List
// Tag List menu including Remove All Items?

artBlob = require('fs').readFileSync('./art.jfif');
var showIncoming = true;
var showOutgoing = true;


module.exports.formatBuf = formatBuf;
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

module.exports.assertParsed = assertParsed;
function assertParsed(data, info){
	var backwards = info.toBuffer();
	if(info.length!==data.length){
		console.error('Incoming/generated item length mismatch!');
		console.error(formatBuf(data));
		console.error(formatBuf(backwards));
		throw new Error('Incoming/generated length mismatch');
	}
	if(backwards.compare(data)){
		console.error('Incoming/generated item data mismatch!');
		console.error(formatBuf(data));
		console.error(formatBuf(backwards));
		throw new Error('Incoming/generated data mismatch');
	}
}

module.exports.Item = {
	"10": Item10,
	"11": Item11,
	"14": Item14,
	"20": Item20,
	"22": Item22,
	"30": Item30,
	"31": Item31,
	"40": Item40,
	"41": Item41,
	"42": Item42,
}

module.exports.parseData = parseData;
function parseData(data){
	//console.log('Parse: ', data);
	if(!(data instanceof Buffer)) throw new Error('data not a buffer');
	// The first packet that comes in on the connection always seems to be the handshake:
	// the same five bytes in both directions, client first
	var magic_handshake = new Buffer([0x11, 0x00, 0x00, 0x00, 0x01]);
	if(data.slice(0,5).compare(magic_handshake)==0){
		return new ItemHandshake(data);
	}
	var itemType = data[0x0b];
	// The second packet that comes in seems to be this "hello" packet, the same 0x2a bytes except for the last one
	var incoming_hello = new Buffer([ 0x11, 0x87, 0x23, 0x49, 0xae, 0x11, 0xff, 0xff ]);
	if(data.slice(0,8).compare(incoming_hello)==0){
		if(itemType==0x40){
			return new ItemSup(data);
		}else if(itemType==0x00){
			return new ItemHello(data);
		}else{
			throw new Error('this is not my cat');
		}
	}
	var ItemStruct = module.exports.Item[itemType.toString(16)];
	if(!ItemStruct) throw new Error('Unknown item type '+itemType.toString(16));
	return new ItemStruct(data);
}

function ItemHandshake(){
	this.length = 5;
}
ItemHandshake.prototype.toBuffer = function toBuffer(){
	return new Buffer([0x11, 0x00, 0x00, 0x00, 0x01]);
}


function ItemHello(data){
	this.length = 0x25;
	if(data instanceof Buffer){
		this.channel = data[0x24];
	}else if(typeof data=='object'){
		this.channel = data.channel;
	}else{
		this.channel = data;
	}
}
ItemHello.prototype.toBuffer = function toBuffer(){
	return new Buffer([
		0x11, 0x87, 0x23, 0x49, 0xae, 0x11, 0xff, 0xff,  0xff, 0xfe, 0x10, 0x00, 0x00, 0x0f, 0x01, 0x14,
		0x00, 0x00, 0x00, 0x0c, 0x06, 0x00, 0x00, 0x00,  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		0x11, 0x00, 0x00, 0x00, 0x03,
	]);
}


function ItemSup(data){
	this.length = 0x2a;
	if(data instanceof Buffer){
		this.channel = data[0x29];
	}else if(typeof data=='object'){
		this.channel = data.channel;
	}else{
		this.channel = data;
	}
}
ItemSup.prototype.toBuffer = function toBuffer(){
	var _x29 = this.channel;
	return new Buffer([
		0x11, 0x87, 0x23, 0x49, 0xae, 0x11, 0xff, 0xff,  0xff, 0xfe, 0x10, 0x40, 0x00, 0x0f, 0x02, 0x14,
		0x00, 0x00, 0x00, 0x0c, 0x06, 0x06, 0x00, 0x00,  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		0x11, 0x00, 0x00, 0x00, 0x00, 0x11, 0x00, 0x00,  0x00, _x29,
	]);
}


module.exports.Item10 = Item10;
function Item10(data){
	// This also seems to come in a number of different lengths
	// This form is requested for:
	// leng bx0c bx0e Description
	// 0x2f 0x00 0x06 Device main menu
	// 0x2a 0x03 0x02 List of artists, in submenu
	// 0x2a 0x03 0x02 List of artists, in mainmenu(???)
	// 0x2a 0x02 0x02 List of albums, in submenu
	// 0x2a 0x04 0x02 List of tracks, in submenu
	// 0x2a 0x14 0x02 List of keys, in submenu
	
	//      0x03 0x03 A particular artist (???)
	//      0x05 0x04 Artists menu listing
	// - Loading device main menu length=0x2f
	// - Loading Artist submenu length=0x2a
	// TODO this should consume only as many bytes as the item actually takes up
	// The `length` property specifies how many bytes were actually parsed
	if(data instanceof Buffer){
		this.length = data.length;
		this.method = 0x10;
		this.listing = data[0x0c];
		this._x0e = data[0x0e];
		this.requestId = (data[0x08]<<8) + (data[0x09]);
		this.affectedMenu = data[0x22];
		this.submenuItems = data[0x16]; // Seems to be set to 0x06 if the request is a submenu
		this.playlist = 0; // undefined
		this.sortOrder = data[0x29]; // undefined
	}else{
		for(var n in data) this[n]=data;
	}
}
Item10.prototype.toBuffer = function toBuffer(){
	var _x08 = (this.requestId>>8) & 0xff;
	var _x09 = (this.requestId>>0) & 0xff;
	var _x0c = this.listing;
	var _x0e = this._x0e;
	var _x16 = this.submenuItems;
	var _x22 = this.affectedMenu;
	var _x29 = this.sortOrder;
	var b = new Buffer([
		0x11, 0x87, 0x23, 0x49, 0xae, 0x11, 0x03, 0x80,  _x08, _x09, 0x10, 0x10, _x0c, 0x0f, _x0e, 0x14,
		0x00, 0x00, 0x00, 0x0c, 0x06, 0x06, _x16, 0x00,  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		0x11, 0x03, _x22, 0x04, 0x01, 0x11, 0x00, 0x00,  0x00, _x29,
	]);
	if(_x0c==0){
		// idk if this is the significant byte, but in some cases this extra five bytes is sent
		b = Buffer.concat([b, new Buffer([
			0x11, 0x00, 0xff, 0xff, 0xff,
		])]);
	}
	return b;
}

module.exports.Item11 = Item11;
function Item11(data){
	// This form seems to be called for:
	// - Requesting root playlist (length=0x34)
	// leng bx0c bx0e Description
	// 0x2f 0x03 0x03 Requesting particular artist submenu
	if(data instanceof Buffer){
		// Leng _x16 _x17 _x33
		// 0x34 0x06 0x06 0x00
		// 0x34 0x06 0x06 0x01 (returns main track listing)
		//this.length = data[0x33] ? 0x34 : 0x2f;
		this.length = 0x34;
		this.method = 0x11;
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
	var b = new Buffer([
		0x11, 0x87, 0x23, 0x49, 0xae, 0x11, 0x03, 0x80,  _x08, _x09, 0x10, 0x11, 0x05, 0x0f, 0x04, 0x14,
		0x00, 0x00, 0x00, 0x0c, 0x06, 0x06, _x16, _x17,  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		0x11, 0x03, _x22, 0x04, 0x01, 0x11, 0x00, 0x00,  0x00, 0x00, 0x11, 0x00, 0x00, _x2d, _x2e,
	]);
	if(this.length==0x34){
		b = Buffer.concat([b, new Buffer([
			0x11, 0x00, 0x00, 0x00, _x33,
		])]);
	}
	return b;
}

// This is sent to request the 'Sort' or maybe another pop-up menu
module.exports.Item14 = Item14;
function Item14(data){
	if(data instanceof Buffer){
		this.length = data.length;
		this.method = 0x14;
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

// Album art request


module.exports.Item20 = Item20;
function Item20(data){
	if(data instanceof Buffer){
		this.length = data.length;
		this.method = 0x20;
		this.requestId = (data[0x08]<<8) + (data[0x09]);
		this.resourceId = (data[0x28]<<8) + (data[0x29]);
	}else{
		for(var n in data) this[n]=data;
	}
}
Item20.prototype.toBuffer = function toBuffer(){
	var _x08 = (this.requestId>>8) & 0xff;
	var _x09 = (this.requestId>>0) & 0xff;
	var _x28 = (this.resourceId>>8) & 0xff;
	var _x29 = (this.resourceId>>0) & 0xff;
	return new Buffer([
		0x11, 0x87, 0x23, 0x49, 0xae, 0x11, 0x03, 0x80,  _x08, _x09, 0x10, 0x20, 0x03, 0x0f, 0x02, 0x14,
		0x00, 0x00, 0x00, 0x0c, 0x06, 0x06, 0x00, 0x00,  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		0x11, 0x03, 0x08, 0x04, 0x01, 0x11, 0x00, 0x00,  _x28, _x29,
	]);
}


module.exports.Item22 = Item22;
function Item22(data){
	
}
Item22.prototype.toBuffer = function toBuffer(){
}

// This is sent to request that a particular menu be rendered out to the client
module.exports.Item30 = Item30;
function Item30(data){
	if(data instanceof Buffer){
		this.length = data.length;
		this.method = 0x30;
		this.requestId = (data[0x08]<<8) + (data[0x09]);
		this._x16 = data[0x16];
		this._x17 = data[0x17];
		this.affectedMenu = data[0x22];
		this.offset = (data[0x28]<<8) + (data[0x29]<<0);
		this._x2e = data[0x2e];
		this._x37 = data[0x37]; // This always seems to match the length provided in the earlier navigate request
		this._x38 = data[0x38]; //
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
	var _x37 = this._x37;
	var _x38 = this._x38;
	var _x3d = this._x3d;
	return new Buffer([
		0x11, 0x87, 0x23, 0x49, 0xae, 0x11, 0x03, 0x80,  _x08, _x09, 0x10, 0x30, 0x00, 0x0f, 0x06, 0x14,
		0x00, 0x00, 0x00, 0x0c, 0x06, 0x06, _x16, _x17,  0x06, 0x06, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		0x11, 0x03, _x22, 0x04, 0x01, 0x11, 0x00, 0x00,  _x28, _x29, 0x11, 0x00, 0x00, 0x00, _x2e, 0x11,
		0x00, 0x00, 0x00, 0x00, 0x11, 0x00, 0x00, _x37,  _x38, 0x11, 0x00, 0x00, 0x00, _x3d,
	]);
}


// This can be sent in between a navigate request and a render-menu request
// Sent out after a list is re-sorted
module.exports.Item31 = Item31;
function Item31(data){
	if(data instanceof Buffer){
		this.length = data.length;
		this.method = 0x31;
		this.requestId = (data[0x08]<<8) + (data[0x09]);
	}else{
		for(var n in data) this[n]=data;
	}
}
Item31.prototype.toBuffer = function toBuffer(){
	var _x08 = (this.requestId>>8) & 0xff;
	var _x09 = (this.requestId>>0) & 0xff;
	return new Buffer([
		0x11, 0x87, 0x23, 0x49, 0xae, 0x11, 0x03, 0x80,  _x08, _x09, 0x10, 0x31, 0x00, 0x0f, 0x04, 0x14,
		0x00, 0x00, 0x00, 0x0c, 0x06, 0x06, 0x06, 0x06,  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		0x11, 0x03, 0x01, 0x04, 0x01, 0x11, 0x00, 0x00,  0x2a, 0x26, 0x11, 0x00, 0x00, 0x00, 0x00, 0x11,
		0x00, 0x00, 0x00, 0x00,
	]);
}

module.exports.Item40 = Item40;
function Item40(r, responseBody, aaaa, bbbb, len){
	this.length = 0x2a;
	if(r instanceof Buffer){
		var data = r;
		this.requestId = (data[8]<<8) + (data[9]);
		// responseBody seems to indicate if there will be additional 41 messages and a trailing 42 message
		this.responseBody = data[0x0c]; // 0x02 for album art, 0x01 if there's menu items, 0x00 if last message
		this._x0e = data[0x0e]; // This seems to be 0x04 if album art, 0x02 otherwise
		this._x16 = data[0x16]; // This seems to be 0x06 if album art, 0x00 otherwise
		this._x17 = data[0x17]; // This seems to be 0x03 if album art, 0x00 otherwise
		this._x23 = data[0x23];
		this._x24 = data[0x24];
		this.itemCount = (data[0x28]<<8) + (data[0x29]);
		if(this._x0e==0x04){
			this._x2d = data[0x2d];
			this._x2e = data[0x2e];
			this._x2f = data[0x2f];
			this.length = 0x34 + (data[0x32]<<8) + (data[0x33]<<0);
			this.bodyData = data.slice(0x34, this.length);
		}
	}else{
		this.requestId = r;
		// responseBody seems to indicate if there will be additional 41 messages and a trailing 42 message
		this.responseBody = responseBody;
		this._x23 = aaaa;
		this._x24 = bbbb;
		this.itemCount = len;
	}
}
Item40.prototype.toBuffer = function toBuffer(){
	// aaaa seems to list whichever "method" was used by the request in byte 0xb except for 0x30 which is 0
	var _x08 = (this.requestId>>8) & 0xff;
	var _x09 = (this.requestId>>0) & 0xff;
	var _x0c = this.responseBody;
	var _x0e = this._x0e;
	var _x16 = this._x16;
	var _x17 = this._x17;
	var _x23 = this._x23;
	var _x24 = this._x24;
	var len0 = (this.itemCount>>8) & 0xff;
	var len1 = (this.itemCount>>0) & 0xff;
	var b = new Buffer([
		0x11, 0x87, 0x23, 0x49, 0xae, 0x11, 0x03, 0x80,  _x08, _x09, 0x10, 0x40, _x0c, 0x0f, _x0e, 0x14,
		0x00, 0x00, 0x00, 0x0c, 0x06, 0x06, _x16, _x17,  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		0x11, 0x00, 0x00, _x23, _x24, 0x11, 0x00, 0x00,  len0, len1,
	]);
	if(this._x0e==0x04){
		var _x32 = (this.bodyData.length>>8) & 0xff;
		var _x33 = (this.bodyData.length>>0) & 0xff;
		var _x2d = this._x2d;
		var _x2e = this._x2e;
		var _x2f = this._x2f;
		b = Buffer.concat([
			b,
			new Buffer([
				0x11, 0x00, 0x00, _x2d, _x2e, _x2f,  0x00, 0x00, _x32, _x33,
			]),
			this.bodyData,
		]);
	}
	return b;
}

module.exports.Item41 = Item41;
function Item41(requestId, symbol, numeric, label, symbol2, numeric2, label2){
	if(requestId instanceof Buffer){
		var data = requestId;
		// lots of offsets to calculate
		var offset = (data[0x2d]<<8) + (data[0x2e]);
		var labelLen = (data[0x32]<<8) + (data[0x33]) - 1; // subtract null terminator
		var start1 = labelLen*2;
		var label2Len = (data[0x3e+start1]<<8) + (data[0x3f+start1]) - 1; // subtract null terminator
		var start2 = labelLen*2 + label2Len*2;
		this.length = 0x60 + offset - 2 + label2Len*2; // 0x60 already includes null character
		// collect data
		this.requestId = (data[8]<<8) + (data[9]);
		this.numeric2 = (data[0x23]<<8) + (data[0x24]);
		this.numeric = (data[0x28]<<8) + (data[0x29]);
		this.symbol2 = data[0x45+start2];
		this.symbol = data[0x46+start2];
		this.label = '';
		for(var i=0; i<labelLen; i++) this.label += String.fromCharCode(data.readUInt16BE(0x34+i*2));
		this.label2 = '';
		this._x3a = data[0x3a+start1]; // 0x02 normally, observed 0x2a with a second column view
		for(var i=0; i<label2Len; i++) this.label2 += String.fromCharCode(data.readUInt16BE(0x40+start1+i*2));
		this._x48 = data[0x48+start2]; // 0x00 normally, seems to be set to 0x01 when using the second column
		this._x4f_2 = (data[0x4f+start2]<<8) + (data[0x50+start2]);
		this._x55 = data[0x55+start2];
		this._x59 = data[0x59+start2];
		this._x5f = data[0x5f+start2];
	}else if(typeof requestId=='data'){
		for(var n in data) this[n]=data;
	}else{
		this.length = 0x60 + label.length*2;
		this.requestId = requestId;
		this.symbol = symbol;
		this.numeric = numeric;
		this.label = label;
		this.symbol2 = symbol2 || 0;
		this.numeric2 = numeric2 || 0;
		this.label2 = label2 || "";
		this._x49_2 = 0; // dunno what this is
	}
}
Item41.prototype.toBuffer = function toBuffer(){
	var iiii = this.iiii || 0;
	// A table of possible values is found in <table.txt> section "DBSERVER ICON TABLE"

	var _x08 = (this.requestId>>8) & 0xff;
	var _x09 = (this.requestId>>0) & 0xff;
	var _x23 = (this.numeric2>>8) & 0xff;
	var _x24 = (this.numeric2>>0) & 0xff;
	var _x28 = (this.numeric>>8) & 0xff;
	var _x29 = (this.numeric>>0) & 0xff;
	var size = this.label.length*2 + 2;
	var _x2d = (size<<8) & 0xff;
	var _x2e = (size<<0) & 0xff;
	var _x3a = this._x3a;
	var _x45 = this.symbol2 || 0; // Icon for second column
	var _x46 = this.symbol;
	var _x48 = this._x48;
	var _x4f = (this._x4f_2>>8) & 0xff;
	var _x50 = (this._x4f_2>>0) & 0xff;
	var _x55 = this._x55;
	var _x59 = this._x59;
	var _x5f = this._x5f;
	var len0 = (this.label.length+1) >> 8;
	var len1 = (this.label.length+1) & 0xff;
	var lem0 = (this.label2.length+1) >> 8;
	var lem1 = (this.label2.length+1) & 0xff;
	var buf = new Buffer(0x60 + this.label.length*2 + this.label2.length*2);
	buf.fill();
	var tpl = new Buffer([
		0x11, 0x87, 0x23, 0x49, 0xae, 0x11, 0x03, 0x80,  _x08, _x09, 0x10, 0x41, 0x01, 0x0f, 0x0c, 0x14,
		0x00, 0x00, 0x00, 0x0c, 0x06, 0x06, 0x06, 0x02,  0x06, 0x02, 0x06, 0x06, 0x06, 0x06, 0x06, 0x06,
		0x11, 0x00, 0x00, _x23, _x24, 0x11, 0x00, 0x00,  _x28, _x29, 0x11, 0x00, 0x00, _x2d, _x2e, 0x26,
		0x00, 0x00, len0, len1, 0x00, 0x00, 0x11, 0x00,  0x00, 0x00, _x3a, 0x26, 0x00, 0x00, lem0, lem1,
		0x00, 0x00, 0x11, 0x00, 0x00, _x45, _x46, 0x11,  _x48, 0x00, 0x00, 0x00, 0x11, 0x00, 0x00, _x4f,
		_x50, 0x11, 0x00, 0x00, 0x00, _x55, 0x11, 0x00,  0x00, _x59, 0x00, 0x11, 0x00, 0x00, 0x00, _x5f,
	]);
	// Write up to first string
	tpl.copy(buf, 0, 0, 0x34);
	for(var i=0; i<this.label.length; i++) buf.writeUInt16BE(this.label.charCodeAt(i)||0, 0x34+i*2);
	// Write up to second string
	var start = 0x34+this.label.length*2;
	tpl.copy(buf, start, 0x34, 0x40);
	for(var i=0; i<this.label2.length; i++) buf.writeUInt16BE(this.label2.charCodeAt(i)||0, start+i*2+0xc);
	// Write to end
	tpl.copy(buf, start+0xc+this.label2.length*2, 0x40, 0x60);
	return buf;
}

module.exports.Item42 = Item42;
function Item42(data){
	this.length = 0x20;
	if(data instanceof Buffer){
		this.requestId = (data[8]<<8) + (data[9]);
	}else if(typeof data=='object'){
		this.requestId = data.requestId;
	}else{
		this.requestId = data;
	}
}
Item42.prototype.toBuffer = function toBuffer(){
	var _x08 = (this.requestId>>8) & 0xff;
	var _x09 = (this.requestId>>0) & 0xff;
	var b = new Buffer([
		0x11, 0x87, 0x23, 0x49, 0xae, 0x11, 0x03, 0x80,  _x08, _x09, 0x10, 0x42, 0x01, 0x0f, 0x00, 0x14,
		0x00, 0x00, 0x00, 0x0c, 0x00, 0x00, 0x00, 0x00,  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
	]);
	return b;
}

function handleDBServerConnection(device, socket) {
	console.log('DBServer: New connection at '+socket.localPort);
	var state = socket.state = {};
	state.length = 0;
	state.initialized = 0;
	state.buffer = new Buffer(0); // Hold onto packets while they're incomplete
	state.menus = {}
	socket.on('data', function(newdata) {
		state.length += newdata.length;
		var data = state.buffer.length ? state.buffer.concat(newdata) : newdata;
		console.log('< DBServer incoming request');
		console.log(formatBuf(data));
		var info = parseData(data);
		console.log('  DBServer '+info.constructor.name);
		var r = info.requestId;
		var type = info.method;
		assertParsed(data, info);
		console.log(info);

		var magic_handshake = new Buffer([0x11, 0x00, 0x00, 0x00, 0x01]);
		if(state.initialized===0){
			// The first packet that comes in on the connection always seems to be the handshake:
			// the same five bytes in both directions, client first
			if(info instanceof ItemHandshake){
				console.log('> DBServer ItemHandshake');
				socket.write(new ItemHandshake().toBuffer());
			}else{
				throw new Error('Invalid handshake');
			}
			state.initialized = 1;
			return;
		}
		// The second packet that comes in seems to be this "hello" packet, the same 0x2a bytes except for the last one
		if(info instanceof ItemHello){
			console.log('  chan='+info.channel);
			// Form the response
			console.log('> DBServer ItemSup');
			socket.write(new ItemSup(device.channel).toBuffer());
			return;
		}
		// All of the other requests follow this magic pattern
		var magic_header = new Buffer([0x11, 0x87, 0x23, 0x49, 0xae, 0x11, 0x03, 0x80]);
		if(data.slice(0,8).compare(magic_header)!=0){
			console.error(magic_header);
			console.error(data);
			throw new Error('Invalid magic header');
		}
		if(info instanceof Item10){
			console.log('  navigate to device menu');
			var menu = state.menus[info.affectedMenu] = {};
			menu.method = info.method;
			menu.listing = info.listing;
			menu.playlist = 0; // undefined
			if(menu.listing==0x00){
				menu.items = [
					new Item41(r, 0x90, 0x3, "\ufffaArtists\ufffb"),
					new Item41(r, 0x90, 0x2, "\ufffaAlbums\ufffb"),
					new Item41(r, 0x83, 0x4, "\ufffaTracks\ufffb"),
					new Item41(r, 0x90, 0xc, "\ufffaKey\ufffb"),
					new Item41(r, 0x90, 0x5, "\ufffaPlaylist\ufffb"),
					new Item41(r, 0x90, 0x16, "\ufffaHistory\ufffb"),
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
					new Item41(r, 0x04, 0x1778, "Dido", 0x07, 0x36af),
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
			var response_prerequest = new Item40(r, 0, type, 0x02, menu.items.length).toBuffer();
			console.log('> DBServer do navigate');
			if(showOutgoing) console.log(formatBuf(response_prerequest));
			socket.write(response_prerequest);
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
			var response_prerequest = new Item40(r, 0, type, 0x05, menu.items.length).toBuffer();
			console.log('> DBServer navigate to playlist id='+info.playlist.toString(16)+'');
			if(showOutgoing) console.log(formatBuf(response_prerequest));
			socket.write(response_prerequest);
			return;
		}
		if(info instanceof Item14){
			var menu = state.menus[info.affectedMenu] = {};
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
			var response_prerequest = new Item40(r, 0, type, 0x00, menu.items).toBuffer();
			if(showOutgoing) console.log(formatBuf(response_prerequest));
			socket.write(response_prerequest);
			return;
		}
		if(info instanceof Item20){
			var affectedMenu = data[0x22];
			var menu = state.menus[affectedMenu] = {};
			menu.method = info.method;
			menu.listing = data[0x0c];
			console.log('> DBServer navigate to tracks listing='+menu.listing.toString(16));
			menu.items = [
				new Item41(r, 0x23, 1, "x20"),
				new Item41(r, 0x90, 0x14, "Folder 2"),
				new Item41(r, 0x90, 0x10, "Folder 3"),
				new Item41(r, 0x90, 0x2a, "Playlist 4"),
				new Item41(r, 0x90, 0x3d, "Playlist 5"),
				new Item41(r, 0x90, 0x37, "Playlist 6"),
			];
			var response_prerequest = new Item40(r, 0, type, 0x06, menu.items.length).toBuffer();
			console.log('> DBServer open sort menu');
			if(showOutgoing) console.log(formatBuf(response_prerequest));
			socket.write(response_prerequest);
			return;
		}
		if(info instanceof Item30){
			var menuLabels = {
				1: 'mainmenu',
				2: 'submenu',
				5: 'sortmenu',
			}
			var menu = state.menus[info.affectedMenu];
			var menuLabel = menuLabels[info.affectedMenu] || info.affectedMenu.toString(16);
			var response = menu.items.slice(info.offset, info.offset+6);
			response.unshift(new Item40(r, 0x01, 0x00, 0x01, 0));
			response.push(new Item42(r));
			response = response.map(function(v){ return v.toBuffer(); });
			console.log('> DBServer renderMenu menu='+menuLabel+' offset='+info.offset.toString(16));
			if(showOutgoing) console.log(response.map(formatBuf).join(''));
			socket.write(Buffer.concat(response));
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
		if(info instanceof Item40){
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
		console.log('DBServer: Connection closed');
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


