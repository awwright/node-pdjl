
var dgram = require("dgram");
var net = require("net");
var http = require('http');
var React = require('react');

var ifaceConf = require('./iface.json');
var DJMDevice = require('./libdjm.js').DJMDevice;

var device = new DJMDevice;
device.channel = ifaceConf.channel || 4;
device.macaddr = ifaceConf.mac;
device.ipaddr = ifaceConf.ip;
device.broadcastIP = ifaceConf.bcast;
console.log('Chan: '+device.channel);
console.log('MAC: '+device.macaddr);
console.log('IP: '+device.ipaddr);
console.log('Bcast: '+device.broadcastIP);

var sock0 = device.sock0 = dgram.createSocket("udp4");
var sock1 = device.sock1 = dgram.createSocket("udp4");
var sock2 = device.sock2 = dgram.createSocket("udp4");

sock0.on("message", device.onMsg0.bind(device));
sock1.on("message", device.onMsg1.bind(device));
sock2.on("message", device.onMsg2.bind(device));

sock0.on("listening", function () {
	var address = sock0.address();
	console.log("server listening " +	address.address + ":" + address.port);
});
sock1.on("listening", function () {
	var address = sock1.address();
	console.log("server listening " +	address.address + ":" + address.port);
});
sock2.on("listening", function () {
	var address = sock2.address();
	console.log("server listening " +	address.address + ":" + address.port);
});

var waiting = 3;
sock0.bind(50000, device.ipaddr, function onBound0(){
	console.log('bound0', device.ipaddr, device.broadcastIP);
	sock0.setBroadcast(true);
	sock0.addMembership(device.broadcastIP);
	doneBind();
});
sock1.bind(50001, device.ipaddr, function onBound1(){
	console.log('bound1', device.ipaddr, device.broadcastIP);
	sock1.setBroadcast(true);
	sock1.addMembership(device.broadcastIP);
	doneBind();
});
sock2.bind(50002, device.ipaddr, function onBound2(){
	console.log('bound2', device.ipaddr, device.broadcastIP);
	sock2.setBroadcast(true);
	sock2.addMembership(device.broadcastIP);
	doneBind();
});
function doneBind(){
	if(--waiting===0){
		device.boot();
	}
}

var httpd = http.createServer(handleRequest);
var serveStatic = new (require('node-static')).Server('./webroot');
var wss = new (require('ws').Server)({server:httpd});
httpd.listen(8080);

function handleRequest(req, res){
	console.log('Request: '+req.url);
	if(req.url.substring(0,8)=='/static/'){
		serveStatic.serve(req, res);
		return;
	}
	if(req.url=='/'){
		res.setHeader('Content-Type', 'text/html');
		var html = React.renderToStaticMarkup(React.DOM.html({}, [
			React.DOM.head({}, [
				React.DOM.title(null, 'DJM Control'),
				React.DOM.link({rel:'stylesheet', type:'text/css', href:'/static/theme.css'}),
				React.DOM.script({type:'application/javascript', src:'https://cdnjs.cloudflare.com/ajax/libs/react/0.13.0/react-with-addons.js'}),
				React.DOM.script({type:'application/javascript', src:'/static/main.js', async:true}),
			]),
			React.DOM.body({}, [
				React.DOM.h1(null, 'Loading DJM Control...'),
			]),
		]));
		res.end(html);
		return;
	}
	res.statusCode=404;
	res.end('Not Found');
}

wss.on('connection', function connection(ws) {
	ws.on('message', function incoming(message) {
		console.log('received: %s', message);
		var data = JSON.parse(message);
		handlers[data.type](data);
	});
});

var handlers = {
	startStop: function(data){
		var a = [2,2,2,2];
		a[data.channel-1] = data.value;
		device.send1x02(a);
	}
};

device.on2x0a = function(data){
	wss.clients.forEach(function(ws){
		ws.send(JSON.stringify(data));
	});
}

var k=0;
setInterval(function(){
	k++;
}, 1000);


