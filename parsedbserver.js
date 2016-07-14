
var fs = require('fs');

var DBServer = require('./dbserver.js');

var filepath = process.argv[2];
var contents = fs.readFileSync(filepath, 'utf-8');

// Strip comments
//contents = contents.replace(/\s*--.*$/gm, '');
// Strip byte offset and ascii
contents = contents.replace(/^    [0-9A-F]{8}  /gm, '>');
contents = contents.replace(/^[0-9A-F]{8}  /gm, '<');
contents = contents.replace(/^(.(..  ?){1,16}) .+$/gm, '$1');
contents = contents.replace(/ +$/gm, '');
contents = contents.split(/\n/g);

function Section(direction){
	this.direction = direction;
	this.comments = [];
	this.lines = [];
	this.data = null;
}
function pushSection(localDirection){
	if(currentSection.direction=='<') console.log('-- Request');
	else if(currentSection.direction=='>') console.log('-- Response');
	var hex = currentSection.lines.join(' ').replace(/ /g,'');
	currentSection.dataStr = hex;
	currentSection.data = new Buffer(hex, 'hex');
	//currentSection.pretty = DBServer.formatBuf(currentSection.data);
	currentSection.packets = [];
	for(var i=0; currentSection.data[i]>=0;){
		var item = DBServer.parseData(currentSection.data.slice(i));
		item.original = currentSection.data.slice(i, i+item.length);
		i += item.length;
		currentSection.packets.push(item);
		console.log(item);
//		try {
			DBServer.assertParsed(item.original, item);
//		}catch(e){
//			console.log(e.toString());
//		}
	}
	sectionList.push(currentSection);
	console.log('\n');
	currentSection = new Section(localDirection);
}

var sectionList = [];
var currentSection = new Section('<');

contents.forEach(function(v){
	var localDirection = v[0];
	if(!v.length){
		// Blank line? reset to a request
		if('<'!=currentSection.direction){
			pushSection('<');
		}
		console.log('');
		return;
	}else if(localDirection=='-' &&  v[1]=='-'){
		currentSection.comments.push(v);
		console.log(v);
		return;
	}else if(localDirection!=currentSection.direction){
		pushSection(localDirection);
	}
	currentSection.lines.push(v.substring(1));
});
pushSection();

