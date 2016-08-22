module.exports.formatBuf = formatBuf;
function formatBufBytes(b){
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
	return x;
}
function formatBuf(b){
	var x = "";
	var kibble = 0; // A segment (one of the ones usually starting with 0x11 ) within this packet
	var argi = 0; // A segment (one of the ones usually starting with 0x11 ) within this packet
	var itemType = null;
	var itemType0 = null;
	var itemType1 = null;
	var requestType = null;
	for(var i=0; i<b.length; ){
		var attachment = null;
		var ki = i; // kibble start offset
		x += b.slice(i,i+1).toString('hex');
		var chr = b[i];
		if(++i==b.length) break;
		else if(chr==0x10 || chr==0x11){
			// 0x11 marks a 32-bit integer or blob
			// sometimes broken down into multiple components or a bit mask
			// 0x10 appears to be a special version of this that's used as a header
			var b0 = b[i+0];
			var b1 = b[i+1];
			var b2 = b[i+2];
			var b3 = b[i+3];
			var numeric = b.readUInt32BE(i); // Don't read trailing null
			for(var j=i+4; i<j; i++) x += ' ' + b.slice(i,i+1).toString('hex');
			if(chr==0x10){
				var typeHex = b.slice(ki+1,ki+3).toString('hex');
				x += '  (datatype=0x' + typeHex + ' '+JSON.stringify(typeLabels[typeHex])+', tailsize=' + b3 + ')';
				itemType = b.readUInt16BE(ki+1);
				itemType0 = b0;
				itemType1 = b1;
			}
			if(itemType==0x4000 && kibble==4){
				requestType = numeric;
			}
			if(b0==0x87 && b1==0x23) x += '  (Magic)';
			if(b0==0x03 && b1==0x80) x += '  (Request ID)';
			if(b0==0xff && b1==0xff) x += '  (I like your hat)';
		}else if(chr==0x14){
			// 0x14 marks an arbritrary-length series of bytes
			x += ' ' + b.slice(i,i+4).toString('hex');
			var len = b.readUInt32BE(i); // Don't read trailing null
			var str = "";
			i+=4;
			attachment = b.slice(i, i+len);
			i += len;
		}else if(chr==0x26){
			// 0x14 marks a UTF-16BE string
			x += ' ' + b.slice(i,i+4).toString('hex');
			var len = b.readUInt32BE(i)-1; // Don't read trailing null
			var str = "";
			i+=4;
			//for(var j=i+len*2; i<j; i+=2) str += ' ' + b.slice(i,i+2).toString('hex');
			for(var j=i+len*2; i<j; i+=2) str += String.fromCharCode(b.readUInt16BE(i));
			i+=2;
			x += ' (' + len + ') ' + JSON.stringify(str);
		}
		// render selected menu
		if(itemType==0x2002 && kibble==4) x += '  (chan='+b0+' menu='+menuLabels[b1]+' device='+mediaSourceMap[b2]+' ??='+b3+')';
		if(itemType==0x2002 && kibble==5) x += '  (track ID)';
		// request CD track data
		if(itemType==0x2202 && kibble==4) x += '  (chan='+b0+' menu='+menuLabels[b1]+' device='+mediaSourceMap[b2]+')';
		if(itemType==0x2202 && kibble==5) x += '  (track ID)';
		// render selected menu
		if(itemType==0x3000 && kibble==4) x += '  (chan='+b0+' menu='+menuLabels[b1]+' device='+mediaSourceMap[b2]+')';
		if(itemType==0x3000 && kibble==5) x += '  (offset='+numeric+')';
		if(itemType==0x3000 && kibble==6) x += '  (limit='+numeric+')';
		// Response-type packet
		if(itemType==0x4000 && kibble==4) x += '  (method type of call)';
		// Menu item
		if(itemType==0x4101 && kibble==4) x += '  (numeric2 field)';
		if(itemType==0x4101 && kibble==5) x += '  (numeric1 field)';
		if(itemType==0x4101 && kibble==6) x += '  (byte size field)';
		if(itemType==0x4101 && kibble==7) x += '  (label1 field)';
		if(itemType==0x4101 && kibble==8) x += '  (byte size2 field)';
		if(itemType==0x4101 && kibble==9) x += '  (label2 field)';
		if(itemType==0x4101 && kibble==10) x += '  (type='+module.exports.itemTypeLabels[b3]+')';
		if(itemType==0x4101 && kibble==11) x += '  (column configuration(?))';
		if(itemType==0x4101 && kibble==12) x += '  (album art id)';
		// Album art image
		if(itemType==0x4002 && kibble==6) x += '  (attachment size)';
		if(itemType==0x4002 && kibble==7) x += '  (attachment bytestring)';
		// 0x4702
		if(itemType==0x4702 && argi==0) x += '  (request type)';
		//if(itemType==0x4702 && argi==1) x += '  ()';
		if(itemType==0x4702 && argi==2) x += '  (attachment size)';
		if(itemType==0x4702 && argi==3) x += '  (attachment bytestring)';
		//if(itemType==0x4702 && argi==4) x += '  (0x24)';
		//if(itemType==0x4702 && argi==5) x += '  (attachment size)';
		//if(itemType==0x4702 && argi==6) x += '  (attachment size)';
		if(itemType==0x4702 && argi==7) x += '  (attachment size)';
		if(itemType==0x4702 && argi==8) x += '  (attachment bytestring)';
		// The responses
		if(requestType==0x0000 && argi==1) x += '  (channel number)';
		if(requestType==0x4000 && argi==1) x += '  (menu item count)';
		x+="\n";
		if(attachment){
			//x += formatBufBytes(attachment).replace(/^/gm, "    ") + "\n";
			x += '    ' + attachment.toString('hex') + '\n';
		}
		kibble++;
		if(kibble>4) argi++;
	}
	return x;
}

module.exports.assertParsed = assertParsed;
function assertParsed(data, info){
	var backwards = info.toBuffer();
	if(info.length!==data.length){
		console.error('Incoming/generated item length mismatch ('+data.length+'vs'+info.length+'/'+backwards.length+')!');
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

var menuLabels = module.exports.menuLabels = {
	1: 'mainmenu',
	2: 'submenu',
	3: 'trackinfo',
	5: 'sortmenu',
	8: 'system',
};

var mediaSourceMap = {
	1: 'CD',
	2: 'SD',
	3: 'USB',
	4: 'rekordbox',
};

module.exports.itemTypeLabels = {
	0x01: 'Folder',
	0x02: 'Album Title',
	0x03: 'Disc',
	0x04: 'Track Title',
	0x06: 'Genre',
	0x07: 'Artist',
	0x0a: 'Rating',
	0x0b: 'Duration (s)',
	0x0d: 'Tempo (%bpm)',
	0x0f: 'Key',
	0x13: 'Color',
	0x23: 'Comment',
};

// The lower level item parsing

module.exports.Kibble = {
	"10": Kibble10,
	"11": Kibble11,
	"14": Kibble14,
	"26": Kibble26,
};
var typeLabels = module.exports.typeLabels = {
	"0001": 'invalid data',
	"1000": 'load root menu',
	"2002": 'request track information',
	"2003": 'request album art',
	"2004": 'request track waveform summary',
	"2102": 'request track data',
	"2104": 'request track cuepoints',
	"2202": 'request CD track data',
	"2204": 'request beat grid information',
	"2504": 'request more track data 2',
	"3000": 'render menu',
	"3e03": 'inquire about a track from another device',
	"4000": 'response',
	"4001": 'render menu (header)',
	"4002": 'album art',
	"4101": 'render menu (menu item)',
	"4201": 'render menu (footer)',
	"4402": 'track waveform summary',
	"4502": 'track data of some sort response',
	"4602": 'beat grid information',
	"4702": 'track cuepoints',
	"4a02": 'track waveform detail 300Bps',
};

// A kibble is... one of the items in the struct that usually starts with 0x11
module.exports.parseKibble = parseKibble;
function parseKibble(data){
	if(data.length<5) return null;
	//console.log('parseKibble', data);
	if(!(data instanceof Buffer)) throw new Error('data not a buffer');
	var type = data[0];
	var typeHex = data.slice(0,1).toString('hex');
	var KibbleStruct = module.exports.Kibble[typeHex];
	if(!KibbleStruct) throw new Error('Unknown kibble type '+typeHex);
	return new KibbleStruct(data);
}

function parseBiscut(data){
	var parts = [];
	for(var i=0; data[i]>=0;){
		var info = parseKibble(data.slice(i));
		parts.push(info);
		i += info.length;
	}
	return parts;
}

// A 32-bit number or blob when used as a header
function Kibble10(data){
	if(data instanceof Buffer){
		this.type = 0x10;
		if(data[0]!=this.type) throw new Error('Not a 0x10 Kibble');
		this.a = data[1];
		this.b = data[2];
		this.d = data[4];
		this.hex = data.slice(1,3).toString('hex');
		this.length = 5;
	}else{
		this.a = data.a;
		this.b = data.b;
		this.d = data.d;
	}
}
Kibble10.prototype.toBuffer = function toBuffer(){
	var d = this.data;
	return new Buffer([
		0x10, this.a, this.b, 0x0f, this.d,
	]);
}

// A 32-bit number or blob
function Kibble11(data){
	this.meta = 0x06;
	this.type = 0x11;
	this.length = 5;
	if(data instanceof Buffer){
		if(data[0]!=this.type) throw new Error('Not a 0x11 Kibble');
		this.data = data.slice(1,5);
		this.uint = data.readUInt32BE(1);
	}else if(typeof data=='number'){
		this.data = new Buffer(4);
		this.data.writeUInt32BE(data, 0);
		this.uint = data;
	}else{
		throw new Error('No initial value');
	}
}
Kibble11.requestId = function(r){
	return new Kibble11(0x03800000 + r);
}
Kibble11.prototype.toBuffer = function toBuffer(){
	var d = this.data;
	return new Buffer([
		0x11, d[0], d[1], d[2], d[3],
	]);
}

// A variable-length blob
function Kibble14(data){
	this.meta = 0x03;
	this.type = 0x14;
	this.length = 0;
	if(data instanceof Buffer){
		if(data[0]!=this.type) throw new Error('Not a 0x14 Kibble');
		var size = data.readUInt32BE(1);
		this.setData(data.slice(5,5+size));
	}
}
Kibble14.prototype.setData = function setData(buf){
	if(!buf || buf.length==0){
		this.data = null;
		this.length = 0;
	}else{
		this.data = buf;
		this.length = 5 + this.data.length;
	}
}
Kibble14.prototype.toBuffer = function toBuffer(){
	if(!this.data ||this.data.length==0) return new Buffer(0);
	var size = new Buffer([0x14, 0, 0, 0, 0]);
	size.writeUInt32BE(this.data.length, 1);
	return Buffer.concat([size, this.data], 5+this.data.length);
}
Kibble14.blob = function(b){
	var k = new Kibble14();
	k.setData(b);
	return k;
}

// A variable-length UTC-16BE string
function Kibble26(data){
	this.meta = 0x02;
	this.type = 0x26;
	this.length = 7;
	if(data instanceof Buffer){
		if(data[0]!=this.type) throw new Error('Not a 0x14 Kibble');
		var size = data.readUInt32BE(1) - 1;
		this.string = ""; // don't include trailing null
		for(var i=0; i<size; i++) this.string += String.fromCharCode(data.readUInt16BE(5 + i*2));
		this.length = 5 + size*2 + 2;
	}else{
		this.string = "";
	}
}
Kibble26.prototype.setData = function setData(str){
	this.string = str;
	this.length = 5 + this.string.length*2 + 2;
}
Kibble26.prototype.toBuffer = function toBuffer(){
	var buf = new Buffer(5 + this.string.length*2 + 2);
	buf.fill();
	buf[0] = 0x26;
	buf.writeUInt32BE(this.string.length+1, 1);
	for(var i=0; i<this.string.length; i++) buf.writeUInt16BE(this.string.charCodeAt(i)||0, 5 + i*2);
	return buf;
}
Kibble26.string = function(b){
	var k = new Kibble26();
	k.setData(b);
	return k;
}


// Higher level parsing functions

var mapItem = module.exports.mapItem = {
	"10": Item10,
	"11": Item11,
	"14": Item14,
	"20": Item20,
	"2002": Item2002,
	"2003": Item2003,
	"2004": Item2004,
	"2102": Item2102,
	"2104": Item2104,
	"2202": Item2202,
	"2204": Item2204,
	"2504": Item2504,
	"2904": Item2904,
	"30": Item30,
	"31": Item31,
	"3e03": Item3e03,
	"4000": Item4000,
	"4001": Item4001,
	"4002": Item4002,
	"41": Item41,
	"42": Item42,
	"4402": Item4402,
	"4502": Item4502,
	"4602": Item4602,
	"4702": Item4702,
	"4a02": Item4a02,
	"4b02": Item4b02,
};

module.exports.parseMessage = parseMessage;
function parseMessage(data){
	//console.log('Parse: ', data);
	if(!(data instanceof Buffer)) throw new Error('data not a buffer');
	var offset = 0;
	var info0 = parseKibble(data);
	if(!info0) return null;
	offset += info0.length;
	// The first packet that comes in on the connection always seems to be the handshake:
	// the same five bytes in both directions, client first
	if(info0 instanceof Kibble11 && info0.uint===1){
		return new ItemHandshake(data);
	}
	// All other packets will carry this magic number
	if(info0 instanceof Kibble11 && info0.uint!==0x872349ae){
		throw new Error('Invalid magic header');
	}
	// Look up second and third kibble
	var info1 = parseKibble(data.slice(offset));
	if(!info1) return null;
	offset += info1.length;
	var info2 = parseKibble(data.slice(offset));
	if(!info2) return null;
	offset += info2.length;
	if(!(info2 instanceof Kibble10)){
		throw new Error('Missing Kibble10');
	}
	// Maybe it's a Hello or Sup
	if(info1.uint==0xfffffffe){
		if(info2.hex==='0000'){
				return new ItemHello(data);
		}else if(info2.hex==='4000'){
			return new ItemSup(data);
		}else{
			// this happens sometimes if there's a protocol problem
			throw new Error('this is not my cat: '+info2.hex);
		}
	}
	// info3 tells us which arguments to expect
	var info3 = parseKibble(data.slice(offset));
	if(!info3) return null;
	offset += info3.length;
	if(!(info3 instanceof Kibble14)){
		throw new Error('Missing Kibble14');
	}
	// Everything after here is optional arguments
	var item = new Item(info1.uint & 0xffff, info2.a, info2.b, []);
	item.d = info2.d;
	for(var i=0; i<info3.data.length; i++){
		if(!info3.data[i]) continue;
		if(info3.data[i]==0x03 && item.args[i-1].uint==0){
			item.args.push(Kibble14.blob(new Buffer(0)));
			continue;
		}
		var infon = parseKibble(data.slice(offset));
		if(!infon) return null;
		item.args.push(infon);
		offset += infon.length;
	}
	item.length = item.toBuffer().length;
	return item;
}

module.exports.parseItem = parseItem;
function parseItem(message, data){
	var ItemStruct = mapItem[((message.a<<8)|(message.b)).toString(16)] || mapItem[message.a.toString(16)];
	if(!ItemStruct) throw new Error('Unknown item type '+message.a.toString(16));
	var item = new ItemStruct(data);
	assertParsed(data.slice(0,item.length), item);
	return item;
}

module.exports.Item = Item;
function Item(r, a, b, kibbles){
	this.requestId = r;
	this.a = a;
	this.b = b;
	this.args = kibbles;
}
Item.prototype.toBuffer = function toBuffer(){
	if(!this.meta){
		var meta = new Buffer(0x0c);
		meta.fill(0);
		this.args.forEach(function(v, i){
			meta[i] = v.meta;
		})
	}
	var k = [
		new Kibble11(0x872349ae),
		Kibble11.requestId(this.requestId),
		new Kibble10({a:this.a, b:this.b, d:this.d||this.args.length}),
		Kibble14.blob(meta),
	].concat(this.args);
	return Buffer.concat(k.map(function(v){ return v.toBuffer(); }));
}

module.exports.ItemHandshake = ItemHandshake;
function ItemHandshake(){
	this.length = 5;
}
ItemHandshake.prototype.toBuffer = function toBuffer(){
	return new Buffer([0x11, 0x00, 0x00, 0x00, 0x01]);
}

module.exports.ItemHello = ItemHello;
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
	return Buffer.concat([
		new Kibble11(0x872349ae).toBuffer(),
		new Kibble11(0xfffffffe).toBuffer(),
		new Buffer([0x10, 0x00, 0x00, 0x0f, 0x01]),
		Kibble14.blob(new Buffer([6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])).toBuffer(),
		new Kibble11(this.channel).toBuffer(),
	]);
}

module.exports.ItemSup = ItemSup;
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
	return Buffer.concat([
		new Kibble11(0x872349ae).toBuffer(),
		new Kibble11(0xfffffffe).toBuffer(),
		new Buffer([0x10, 0x40, 0x00, 0x0f, 0x02]), // sup reply is 0x02
		Kibble14.blob(new Buffer([6, 6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])).toBuffer(),
		new Kibble11(0).toBuffer(),
		new Kibble11(this.channel).toBuffer(),
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
		this.requestId = (data[0x08]<<8) + (data[0x09]);
		this.affectedMenu = data[0x22];
		this.submenuItems = data[0x16]; // Seems to be set to 0x06 if the request is a submenu
		this.playlist = 0; // undefined
		this.sortOrder = data[0x29]; // undefined
	}else{
		for(var n in data) this[n]=data[n];
	}
}
Item10.prototype.toBuffer = function toBuffer(){
	var b = new Item(this.requestId, 0x10, this.listing, [
		new Kibble11(0x03000401 | (this.affectedMenu<<16)),
		new Kibble11(this.sortOrder),
	]);
	if(this.listing==0){
		b.args.push(new Kibble11(0x00ffffff));
	}
	return b.toBuffer();
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
		this.requestId = (data[0x08]<<8) | (data[0x09]);
		this.affectedMenu = data[0x22];
		this.playlist = (data[0x2d]<<8) | data[0x2e];
		this._x33 = data[0x33];
	}else{
		for(var n in data) this[n]=data[n];
	}
}
Item11.prototype.toBuffer = function toBuffer(){
	var b = new Item(this.requestId, 0x11, 0x05, [
		new Kibble11(0x03000401 | (this.affectedMenu<<16)),
		new Kibble11(0),
		new Kibble11(this.playlist),
	]);
	if(this._x33>=0){
		b.args.push(new Kibble11(this._x33));
	}
	return b.toBuffer();
}

// This is sent to request the 'Sort' or maybe another pop-up menu
module.exports.Item14 = Item14;
function Item14(data){
	if(data instanceof Buffer){
		this.length = data.length;
		this.method = 0x14;
		this.requestId = (data[0x08]<<8) | (data[0x09]);
		this.affectedMenu = data[0x22];
	}else{
		for(var n in data) this[n]=data[n];
	}
}
Item14.prototype.toBuffer = function toBuffer(){
	return new Item(this.requestId, 0x14, 0x00, [
		new Kibble11(0x03000401|(this.affectedMenu<<16)),
		new Kibble11(0),
		new Kibble11(0x1004),
	]).toBuffer();
}

// Also a track info menu request???
// For album art request see Item2003
module.exports.Item20 = Item20;
function Item20(data){
	if(data instanceof Buffer){
		this.length = data.length;
		this.method = 0x20;
		this.listing = data[0x0c];
		console.log(data.slice(0x10));
		this.m2 = data[0x16];
		this.requestId = (data[0x08]<<8) + (data[0x09]);
		this.affectedMenu = data[0x22];
		this.resourceId = (data[0x28]<<8) + (data[0x29]);
	}else{
		for(var n in data) this[n]=data[n];
	}
}
Item20.prototype.toBuffer = function toBuffer(){
	var b = new Item(this.requestId, 0x20, this.listing, [
		new Kibble11(0x03000401|(this.affectedMenu<<16)),
		new Kibble11(this.resourceId),
		new Kibble11(1),
	]);
	return b.toBuffer();
}

// Track information request
module.exports.Item2002 = Item2002;
function Item2002(data){
	this.method = 0x20;
	if(data instanceof Buffer) var message = parseMessage(data);
	else if (data instanceof Item) var message = data;
	if(message instanceof Item){
		this.requestId = message.requestId;
		this.clientChannel = message.args[0].data[0];
		this.affectedMenu = message.args[0].data[1];
		this.sourceMedia = message.args[0].data[2];
		this.sourceAnalyzed = message.args[0].data[3];
		this.resourceId = message.args[1].uint;
	}else{
		for(var n in data) this[n]=data[n];
	}
	this.length = 0x20 + 5 + 5;
}
Item2002.prototype.toBuffer = function toBuffer(){
	var b = new Item(this.requestId, 0x20, 0x02, [
		new Kibble11((this.clientChannel<<24)|(this.affectedMenu<<16)|(this.sourceMedia<<8)|(this.sourceAnalyzed<<0)),
		new Kibble11(this.resourceId),
	]);
	return b.toBuffer();
}

// Album art request
module.exports.Item2003 = Item2003;
function Item2003(data){
	this.length = data.length;
	this.method = 0x20;
	if(data instanceof Buffer) var message = parseMessage(data);
	else if (data instanceof Item) var message = data;
	if(message instanceof Item){
		this.requestId = message.requestId;
		this.clientChannel = message.args[0].data[0];
		this.affectedMenu = message.args[0].data[1];
		this.sourceMedia = message.args[0].data[2];
		this.sourceAnalyzed = message.args[0].data[3];
		this.resourceId = message.args[1].uint;
	}else{
		for(var n in data) this[n]=data[n];
	}
}
Item2003.prototype.toBuffer = function toBuffer(){
	var b = new Item(this.requestId, 0x20, 0x03, [
		new Kibble11((this.clientChannel<<24)|(this.affectedMenu<<16)|(this.sourceMedia<<8)|(this.sourceAnalyzed<<0)),
		new Kibble11(this.resourceId),
	]);
	return b.toBuffer();
}

// Track data request
module.exports.Item2004 = Item2004;
function Item2004(data){
	this.length = data.length;
	this.method = 0x20;
	if(data instanceof Buffer) var message = parseMessage(data);
	else if (data instanceof Item) var message = data;
	if(message instanceof Item){
		this.requestId = message.requestId;
		this.clientChannel = message.args[0].data[0];
		this.affectedMenu = message.args[0].data[1];
		this.sourceMedia = message.args[0].data[2];
		this.sourceAnalyzed = message.args[0].data[3];
		this.resourceId = message.args[2].uint;
	}else{
		for(var n in data) this[n]=data[n];
	}
}
Item2004.prototype.toBuffer = function toBuffer(){
	var b = new Item(this.requestId, 0x20, 0x04, [
		new Kibble11((this.clientChannel<<24)|(this.affectedMenu<<16)|(this.sourceMedia<<8)|(this.sourceAnalyzed<<0)),
		new Kibble11(4),
		new Kibble11(this.resourceId),
		new Kibble11(0),
		new Kibble14(),
	]);
	return b.toBuffer();
}

// A request for track data
module.exports.Item2102 = Item2102;
function Item2102(data){
	this.method = 0x20;
	this.length = 0x20 + 5 + 5;
	if(data instanceof Buffer) var message = parseMessage(data);
	else if (data instanceof Item) var message = data;
	if(message instanceof Item){
		this.requestId = message.requestId;
		this.clientChannel = message.args[0].data[0];
		this.affectedMenu = message.args[0].data[1];
		this.sourceMedia = message.args[0].data[2];
		this.sourceAnalyzed = message.args[0].data[3];
		this.resourceId = message.args[1].uint;
	}else{
		for(var n in data) this[n]=data[n];
	}
}
Item2102.prototype.toBuffer = function toBuffer(){
	var b = new Item(this.requestId, 0x21, 0x02, [
		new Kibble11((this.clientChannel<<24)|(this.affectedMenu<<16)|(this.sourceMedia<<8)|(this.sourceAnalyzed<<0)),
		new Kibble11(this.resourceId),
	]);
	return b.toBuffer();
}

// A request for more track data
module.exports.Item2104 = Item2104;
function Item2104(data){
	this.method = 0x20;
	this.length = 0x20 + 5 + 5;
	if(data instanceof Buffer) var message = parseMessage(data);
	else if (data instanceof Item) var message = data;
	if(message instanceof Item){
		this.requestId = message.requestId;
		this.clientChannel = message.args[0].data[0];
		this.affectedMenu = message.args[0].data[1];
		this.sourceMedia = message.args[0].data[2];
		this.sourceAnalyzed = message.args[0].data[3];
		this.resourceId = message.args[1].uint;
	}else{
		for(var n in data) this[n]=data[n];
	}
}
Item2104.prototype.toBuffer = function toBuffer(){
	var b = new Item(this.requestId, 0x21, 0x04, [
		new Kibble11((this.clientChannel<<24)|(this.affectedMenu<<16)|(this.sourceMedia<<8)|(this.sourceAnalyzed<<0)),
		new Kibble11(this.resourceId),
	]);
	return b.toBuffer();
}

// Request for CD track info, it seems
module.exports.Item2202 = Item2202;
function Item2202(data){
	this.method = 0x20;
	this.length = 0x20 + 5 + 5;
	if(data instanceof Buffer) var message = parseMessage(data);
	else if (data instanceof Item) var message = data;
	if(message instanceof Item){
		this.requestId = message.requestId;
		this.clientChannel = message.args[0].data[0];
		this.affectedMenu = message.args[0].data[1];
		this.sourceMedia = message.args[0].data[2];
		this.sourceAnalyzed = message.args[0].data[3];
		this.trackNumber = message.args[1].uint;
	}else{
		for(var n in data) this[n]=data[n];
	}
}
Item2202.prototype.toBuffer = function toBuffer(){
	var b = new Item(this.requestId, 0x22, 0x02, [
		new Kibble11((this.clientChannel<<24)|(this.affectedMenu<<16)|(this.sourceMedia<<8)|(this.sourceAnalyzed<<0)),
		new Kibble11(this.trackNumber),
	]);
	return b.toBuffer();
}

// Seems to respond with 0x4602
module.exports.Item2204 = Item2204;
function Item2204(data){
	this.method = 0x20;
	this.length = 0x20 + 5 + 5;
	if(data instanceof Buffer) var message = parseMessage(data);
	else if (data instanceof Item) var message = data;
	if(message instanceof Item){
		this.requestId = message.requestId;
		this.clientChannel = message.args[0].data[0];
		this.affectedMenu = message.args[0].data[1];
		this.sourceMedia = message.args[0].data[2];
		this.sourceAnalyzed = message.args[0].data[3];
		this.resourceId = message.args[1].uint;
	}else{
		for(var n in data) this[n]=data[n];
	}
}
Item2204.prototype.toBuffer = function toBuffer(){
	var b = new Item(this.requestId, 0x22, 0x04, [
		new Kibble11((this.clientChannel<<24)|(this.affectedMenu<<16)|(this.sourceMedia<<8)|(this.sourceAnalyzed<<0)),
		new Kibble11(this.resourceId),
	]);
	return b.toBuffer();
}

// A request for more track data
// Server responds with Item4502
module.exports.Item2504 = Item2504;
function Item2504(data){
	this.method = 0x25;
	this.length = 0x20 + 5 + 5;
	if(data instanceof Buffer) var message = parseMessage(data);
	else if (data instanceof Item) var message = data;
	if(message instanceof Item){
		this.requestId = message.requestId;
		this.clientChannel = message.args[0].data[0];
		this.affectedMenu = message.args[0].data[1];
		this.sourceMedia = message.args[0].data[2];
		this.sourceAnalyzed = message.args[0].data[3];
		this.resourceId = message.args[1].uint;
	}else{
		for(var n in data) this[n]=data[n];
	}
}
Item2504.prototype.toBuffer = function toBuffer(){
	var b = new Item(this.requestId, 0x25, 0x04, [
		new Kibble11((this.clientChannel<<24)|(this.affectedMenu<<16)|(this.sourceMedia<<8)|(this.sourceAnalyzed<<0)),
		new Kibble11(this.resourceId),
	]);
	return b.toBuffer();
}

// A request for more track data 3
// Server responds with Item4a02
module.exports.Item2904 = Item2904;
function Item2904(data){
	this.method = 0x25;
	this.length = 0x20 + 5*3;
	if(data instanceof Buffer) var message = parseMessage(data);
	else if (data instanceof Item) var message = data;
	if(message instanceof Item){
		this.requestId = message.requestId;
		this.clientChannel = message.args[0].data[0];
		this.affectedMenu = message.args[0].data[1];
		this.sourceMedia = message.args[0].data[2];
		this.sourceAnalyzed = message.args[0].data[3];
		this.resourceId = message.args[1].uint;
	}else{
		for(var n in data) this[n]=data[n];
	}
}
Item2904.prototype.toBuffer = function toBuffer(){
	var b = new Item(this.requestId, 0x29, 0x04, [
		new Kibble11((this.clientChannel<<24)|(this.affectedMenu<<16)|(this.sourceMedia<<8)|(this.sourceAnalyzed<<0)),
		new Kibble11(this.resourceId),
		new Kibble11(0),
	]);
	return b.toBuffer();
}

// This is sent to request that a particular menu be rendered out to the client
module.exports.Item30 = Item30;
function Item30(data){
	this.method = 0x30;
	if(data instanceof Buffer) var message = parseMessage(data);
	else if (data instanceof Item) var message = data;
	if(message instanceof Item){
		this.length = data.length;
		this.requestId = message.requestId;
		this.clientChannel = message.args[0].data[0];
		this.affectedMenu = message.args[0].data[1];
		this.sourceMedia = message.args[0].data[2];
		this.sourceAnalyzed = message.args[0].data[3];
		this.offset = message.args[1].uint;
		this.limit = message.args[2].uint;
		this.len_a = message.args[4].uint; // This always seems to match the length provided in the earlier navigate request
		this.opt5 = message.args[5].uint;
	}else{
		for(var n in data) this[n]=data[n];
	}
}
Item30.prototype.toBuffer = function toBuffer(){
	var b = new Item(this.requestId, 0x30, 0x00, [
		new Kibble11((this.clientChannel<<24)|(this.affectedMenu<<16)|(this.sourceMedia<<8)|(this.sourceAnalyzed<<0)),
		new Kibble11(this.offset),
		new Kibble11(this.limit),
		new Kibble11(0),
		new Kibble11(this.len_a),
		new Kibble11(this.opt5),
	]);
	return b.toBuffer();
}


// This can be sent in between a navigate request and a render-menu request
// Sent out after a list is re-sorted
module.exports.Item31 = Item31;
function Item31(data){
	this.method = 0x31;
	this.length = data.length;
	if(data instanceof Buffer) var message = parseMessage(data);
	else if (data instanceof Item) var message = requestId;
	if(message instanceof Item){
		this.requestId = message.requestId;
		this.clientChannel = message.args[0].data[0];
		this.affectedMenu = message.args[0].data[1];
		this.sourceMedia = message.args[0].data[2];
		this.sourceAnalyzed = message.args[0].data[3];
		this.resourceId = message.args[1].uint;
	}else{
		for(var n in data) this[n]=data[n];
	}
	this.length = data.length;
}
Item31.prototype.toBuffer = function toBuffer(){
	var b = new Item(this.requestId, 0x31, 0x00, [
		new Kibble11((this.clientChannel<<24)|(this.affectedMenu<<16)|(this.sourceMedia<<8)|(this.sourceAnalyzed<<0)),
		new Kibble11(this.resourceId),
		new Kibble11(0),
		new Kibble11(0),
	]);
	return b.toBuffer();
}

// Used for requesting a track on another device
module.exports.Item3e03 = Item3e03;
function Item3e03(data){
	this.method = 0x3e;
	this.length = 0x20 + 5;
	if(data instanceof Buffer) var message = parseMessage(data);
	else if (data instanceof Item) var message = data;
	if(message instanceof Item){
		this.requestId = message.requestId;
		this.clientChannel = message.args[0].data[0];
		this.affectedMenu = message.args[0].data[1];
		this.sourceMedia = message.args[0].data[2];
		this.sourceAnalyzed = message.args[0].data[3];
		this.opt0_2 = message.args[0].data[2];
	}else{
		for(var n in data) this[n]=data[n];
	}
}
Item3e03.prototype.toBuffer = function toBuffer(){
	var b = new Item(this.requestId, 0x3e, 0x03, [
		new Kibble11((this.clientChannel<<24)|(this.affectedMenu<<16)|(this.sourceMedia<<8)|(this.sourceAnalyzed<<0)),
	]);
	return b.toBuffer();
}

// A general success packet, carries no attached data
// If a response to a menu navigation request, carries the number of menu items in the requested menu
module.exports.Item4000 = Item4000;
function Item4000(data, aaaa, len){
	this.length = 0x2a;
	if(data instanceof Buffer) var message = parseMessage(data);
	else if (data instanceof Item) var message = requestId;
	if(message instanceof Item){
		this.requestId = message.requestId;
		this.requestType = message.args[0].uint;
		this.itemCount = message.args[1].uint;
	}else if(typeof r=='object'){
		var data = r;
		for(var n in data) this[n]=data[n];
	}else{
		this.requestId = r;
		this.requestType = aaaa;
		this.itemCount = len;
	}
}
Item4000.prototype.toBuffer = function toBuffer(){
	var response = new Item(this.requestId, 0x40, 0x00, [
		new Kibble11(this.requestType),
		new Kibble11(this.itemCount),
	]);
	return response.toBuffer();
}

// Response with attached menu items packet
module.exports.Item4001 = Item4001;
function Item4001(r, aaaa){
	this.length = 0x2a;
	if(r instanceof Buffer) var message = parseMessage(r);
	else if (r instanceof Item) var message = requestId;
	if(message instanceof Item){
		this.requestId = message.requestId;
		this.opt0 = message.args[0].uint; // Usually 0, seems to be 1 if from [Info] menu
		this.opt1 = message.args[1].uint;
	}else if(typeof r=='object'){
		var data = r;
		for(var n in data) this[n]=data[n];
	}else{
		this.requestId = r;
		this.opt1 = 0;
	}
}
Item4001.prototype.toBuffer = function toBuffer(){
	var response = new Item(this.requestId, 0x40, 0x01, [
		new Kibble11(this.opt0),
		new Kibble11(this.opt1),
	]);
	return response.toBuffer();
}

// Response with album art
module.exports.Item4002 = Item4002;
function Item4002(r, responseBody, aaaa, bbbb, len){
	if(r instanceof Buffer) var message = parseMessage(r);
	if(message instanceof Item){
		this.requestId = message.requestId;
		this.body = message.args[3].data;
	}else if(typeof r=='object'){
		var data = r;
		for(var n in data) this[n]=data[n];
	}else{
		this.requestId = r;
		this.itemCount = len;
	}
	this.length = 52 + this.body.length;
}
Item4002.prototype.toBuffer = function toBuffer(){
	var response = new Item(this.requestId, 0x40, 0x02, [
		new Kibble11(0x2003),
		new Kibble11(0),
		new Kibble11(this.body.length),
		Kibble14.blob(this.body),
	]);
	return response.toBuffer();
}

module.exports.Item41 = Item41;
function Item41(requestId, symbol, numeric, label, symbol2, numeric2, label2){
	if(requestId instanceof Buffer){
		var message = parseMessage(requestId);
	}else if (requestId instanceof Item){
		var message = requestId;
	}
	if(message instanceof Item){
		this.length = message.length;
		var data = requestId;
		// collect data
		this.requestId = message.requestId;
		this._x22 = data[0x22]; // Normally 0x00, 0x3e if the field is describing the NFS filepath
		this.numeric2 = message.args[0].uint;
		this.numeric = message.args[1].uint;
		// argument 2 is byte length of argument 3
		this.label = message.args[3].string;
		// argument 4 is byte length of argument 5
		this.label2 = message.args[5].string;
		this.symbol2 = message.args[6].data[2];
		this.symbol = message.args[6].data[3];
		this.opt7 = message.args[7].uint; // 0x00 normally, seems to be set to 0x01 when using the second column
		this.albumArtId = message.args[8].uint;
		this.opt9 = message.args[9].uint;
		this.opta = message.args[10].uint;
		this.optb = message.args[11].uint;
	}else if(typeof requestId=='object'){
		var data = requestId;
		for(var n in data) this[n]=data[n];
	}else{
		this.requestId = requestId;
		this.symbol = symbol;
		this.numeric = numeric;
		this.label = label;
		this.symbol2 = symbol2 || 0;
		this.numeric2 = numeric2 || 0;
		this.label2 = label2 || "";
		this.opt7 = 0;
		this.albumArtId = 0;
		this.opt9 = 0;
		this.opta = 0;
		this.optb = 0;
		this.length = 0x60 + this.label.length*2 + this.label2.length*2;
	}
}
Item41.prototype.toBuffer = function toBuffer(){
	var b = new Item(this.requestId, 0x41, 0x01, [
		new Kibble11((this._x22<<16) | this.numeric2),
		new Kibble11(this.numeric),
		new Kibble11(this.label.length*2 + 2),
		Kibble26.string(this.label),
		new Kibble11(this.label2.length*2 + 2),
		Kibble26.string(this.label2),
		// A table of possible values is found in <table.txt> section "DBSERVER ICON TABLE"
		new Kibble11((this.symbol2<<8)|(this.symbol)),
		new Kibble11(this.opt7),
		new Kibble11(this.albumArtId),
		new Kibble11(this.opt9),
		new Kibble11(this.opta),
		new Kibble11(this.optb),
	]);
	return b.toBuffer();
}

module.exports.Item4402 = Item4402;
function Item4402(requestId){
	if(requestId instanceof Buffer) var message = parseMessage(requestId);
	else if (requestId instanceof Item) var message = requestId;
	if(message instanceof Item){
		this.requestId = message.requestId;
		this.length = message.length;
		this.method = message.args[0].uint;
		this.body = message.args[3].data;
	}else if(typeof requestId=='object'){
		var data = requestId;
		for(var n in data) this[n]=data[n];
	}
}
Item4402.prototype.toBuffer = function toBuffer(){
	var b = new Item(this.requestId, 0x44, 0x02, [
		new Kibble11(0x2004),
		new Kibble11(0),
		new Kibble11(this.body.length),
		Kibble14.blob(this.body),
	]);
	return b.toBuffer();
}

// Seems to be a blob of something?
// Mostly zeros
module.exports.Item4502 = Item4502;
function Item4502(requestId){
	if(requestId instanceof Buffer) var message = parseMessage(requestId);
	else if (requestId instanceof Item) var message = requestId;
	if(message instanceof Item){
		this.requestId = message.requestId;
		this.length = message.length;
		this.method = message.args[0].uint;
		this.body = message.args[3].data;
	}else if(typeof requestId=='object'){
		var data = requestId;
		for(var n in data) this[n]=data[n];
	}
}
Item4502.prototype.toBuffer = function toBuffer(){
	var b = new Item(this.requestId, 0x45, 0x02, [
		new Kibble11(0x2504), // in response to type=0x2504
		new Kibble11(0),
		new Kibble11(this.body.length),
		Kibble14.blob(this.body),
	]);
	return b.toBuffer();
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
	return new Item(this.requestId, 0x42, 0x01, []).toBuffer();
}

// Sent in response to 0x2204
module.exports.Item4602 = Item4602;
function Item4602(requestId){
	if(requestId instanceof Buffer) var message = parseMessage(requestId);
	else if (requestId instanceof Item) var message = requestId;
	if(message instanceof Item){
		this.requestId = message.requestId;
		this.length = message.length;
		this.method = message.args[0].uint;
		this.body = message.args[3].data;
	}else if(typeof requestId=='object'){
		var data = requestId;
		for(var n in data) this[n]=data[n];
	}
}
Item4602.prototype.toBuffer = function toBuffer(){
	var b = new Item(this.requestId, 0x46, 0x02, [
		new Kibble11(0x2204), // in response to type=0x2204
		new Kibble11(0),
		new Kibble11(this.body.length),
		Kibble14.blob(this.body),
		new Kibble11(0),
	]);
	return b.toBuffer();
}

module.exports.Item4702 = Item4702;
function Item4702(data){
	if(data instanceof Buffer) var message = parseMessage(data);
	else if (data instanceof Item) var message = requestId;
	if(message instanceof Item){
		this.requestId = message.requestId;
		this.method = message.args[0].uint;
		this.arg1 = message.args[1].uint;
		this.body3 = message.args[3].data;
		this.arg5 = message.args[5].uint;
		this.arg6 = message.args[6].uint;
		this.body8 = message.args[8].data;
	}else if(typeof data=='object'){
		this.requestId = data.requestId;
	}else{
		this.requestId = data;
		this.method = 0x2104;
	}
	this.length = this.toBuffer().length;
}
Item4702.prototype.toBuffer = function toBuffer(){
	return new Item(this.requestId, 0x47, 0x02, [
		new Kibble11(this.method),
		new Kibble11(this.arg1),
		new Kibble11(this.body3 ? this.body3.length : 0),
		Kibble14.blob(this.body3),
		new Kibble11(0x24),
		new Kibble11(this.arg5),
		new Kibble11(this.arg6),
		new Kibble11(this.body8 ? this.body8.length : 0),
		Kibble14.blob(this.body8),
	]).toBuffer();
}

// Sent in response to 0x2904
module.exports.Item4a02 = Item4a02;
function Item4a02(requestId){
	if(requestId instanceof Buffer) var message = parseMessage(requestId);
	else if (requestId instanceof Item) var message = requestId;
	if(message instanceof Item){
		this.requestId = message.requestId;
		this.length = message.length;
		this.method = message.args[0].uint;
		this.body = message.args[3].data;
	}else if(typeof requestId=='object'){
		var data = requestId;
		for(var n in data) this[n]=data[n];
	}
}
Item4a02.prototype.toBuffer = function toBuffer(){
	var b = new Item(this.requestId, 0x4a, 0x02, [
		new Kibble11(0x2904), // in response to type=0x2204
		new Kibble11(0),
		new Kibble11(this.body.length),
		Kibble14.blob(this.body),
	]);
	return b.toBuffer();
}

// In response to Item3e03
module.exports.Item4b02 = Item4b02;
function Item4b02(data){
	this.method = 0x3e;
	this.length = 0x20 + 5;
	if(data instanceof Buffer) var message = parseMessage(data);
	else if (data instanceof Item) var message = data;
	if(message instanceof Item){
		this.requestId = message.requestId;
		this.requestType = message.args[0].uint;
		this.body = message.args[3].string;
		this.length = 0x20 + 5 + 5 + 5 + 5+this.body.length*2+2;
	}else{
		for(var n in data) this[n]=data[n];
	}
}
Item4b02.prototype.toBuffer = function toBuffer(){
	var b = new Item(this.requestId, 0x4b, 0x02, [
		new Kibble11(this.requestType),
		new Kibble11(0),
		new Kibble11(this.body.length*2+2),
		Kibble26.string(this.body),
	]);
	return b.toBuffer();
}
