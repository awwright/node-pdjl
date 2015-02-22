var dgram = require("dgram");

var server = dgram.createSocket("udp4");

server.on("error", function (err) {
	console.log("server error:\n" + err.stack);
	server.close();
});

server.on("message", function (msg, rinfo) {
	//console.log("server got: " + msg + " from " + rinfo.address + ":" + rinfo.port);
	var type = msg[0x23]; // byte 4d on packet
	var typeStr = ('0'+type.toString(16)).substr(-2);
	var deviceName = msg.toString().substr(0x0b, 16).replace(/\x00/g, '');
	if(type==0x3c){
		console.log(rinfo.address + " " + deviceName + ' ' + typeStr + ' ' + msg[0x5c]);
	}else{
		console.log(rinfo.address + " " + deviceName + ' ' + typeStr);
	}
});

server.on("listening", function () {
	var address = server.address();
	console.log("server listening " +	address.address + ":" + address.port);
});

server.bind(50001);
// server listening 0.
