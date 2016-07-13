
var fs = require('fs');

var DBServer = require('./dbserver.js');

var filepath = process.argv[2];
var contents = fs.readFileSync(filepath, 'utf-8');

// Strip comments
//contents = contents.replace(/\s*--.*$/gm, '');
// Strip byte offset and ascii
contents = contents.replace(/^    ........  /gm, '>');
contents = contents.replace(/^........  /gm, '<');
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
	}
	sectionList.push(currentSection);
	
	currentSection.comments.forEach(function(w){
		console.log(w);
	});
	currentSection.packets.forEach(function(w){
		console.log(w);
		try {
			DBServer.assertParsed(w.original, w);
		}catch(e){
			console.log(e.toString());
		}
	});
	console.log('\n');
	
	currentSection = new Section(localDirection);
}

var sectionList = [];
var currentSection = new Section('<');

contents.forEach(function(v){
	var localDirection = v[0];
	if(!v.length){
		return;
	}else if(localDirection=='-' &&  v[1]=='-'){
		currentSection.comments.push(v);
		return;
	}else if(localDirection!=currentSection.direction){
		pushSection(localDirection);
	}
	currentSection.lines.push(v.substring(1));
});
pushSection();

sectionList.forEach(function(v){
	v.comments.forEach(function(w){ console.log(w); });
	v.packets.forEach(function(w){ console.log(DBServer.formatBuf(w)); });
});

