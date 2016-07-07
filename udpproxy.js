
var dgram = require("dgram");

module.exports = udpForward;

function udpForward(listenPort, listenAddr, targetPort, targetAddr){
	// Create a server to listen for requests on
	var portmapServer = dgram.createSocket("udp4");
	var sockets = {};
	portmapServer.on("message", function(msg, rinfo){
		var id = rinfo.address + ' ' + rinfo.port;
		// If we get a message, determine which client it is associated with
		// If none, reserve an outbound UDP port
		console.log('portmap request '+id);
		var sock = sockets[id] = sockets[id] || createClient(id, rinfo);
		sock.send(msg, 0, msg.length, targetPort, targetAddr);
	});
	portmapServer.on("listening", function () {
		var address = portmapServer.address();
		console.log("portmapServer listening " +	address.address + ":" + address.port);
	});
	portmapServer.bind(listenPort, listenAddr);

	function createClient(id, clientinfo){
		var portmapClient = dgram.createSocket("udp4");
		portmapClient.on("message", function(msg, rinfo){
			console.log('portmap response', msg, clientinfo.port, clientinfo.address);
			portmapServer.send(msg, 0, msg.length, clientinfo.port, clientinfo.address);
		});
		portmapClient.bind(0);
		portmapClient.on("listening", function () {
			var address = portmapClient.address();
			console.log("portmapClient listening " +	address.address + ":" + address.port);
		});
		return portmapClient;
	}
	return portmapServer;
}
