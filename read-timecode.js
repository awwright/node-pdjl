
var DJM = require('djm');

var device = {};
var djmDevice = device.link = new DJM.DJMDevice;
djmDevice.log = function(){};

djmDevice.on1x28 = function(data){
	//console.log('on1x28', data);
	console.log(data);
};
djmDevice.on2x0a = function(data){
	//console.log('on2x0a', data);
}
djmDevice.on2x29 = function(data){
	//console.log('on2x29', data);
}
device.link.setConfigurePassive();
device.link.useTZSPClient = true;
device.link.tzspServer = '192.168.0.98';

device.link.connect();