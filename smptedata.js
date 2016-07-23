
var Readable = require('stream').Readable;

module.exports.asBinary = asBinary;
function asBinary(buf){
	var s = '';
	for(var i=0; i<buf.length; i++){
		for(var j=0; j<8; j++) s += ((buf[i]>>j)&1) ? '-' : '_';
	}
	return s;
}

module.exports.getBit = getBit;
function getBit(buf, offset){
	var byte = offset/8 |0;
	var bit = offset%8;
	return (buf[byte]>>bit) & 1;
}


module.exports.writeBit = writeBit;
function writeBit(buf, offset, val){
	var byte = offset/8 |0;
	var bit = offset%8;
	if(val){
		buf[byte] |= (1<<bit);
	}else{
		buf[byte] &= buf[byte]^(1<<bit);
	}
}

module.exports.generateFrame = generateFrame;
function generateFrame(fr){
	// the SMPTE timecode is a series of 80 bits (i.e. 10 bytes)
	var timeHour = (fr / 25 / 60 / 60) | 0;
	var timeHourTen = timeHour / 10 | 0;
	var timeHourOne = timeHour % 10 | 0;
	var timeMin = (fr / 25 / 60) % 60 | 0;
	var timeMinTen = timeMin / 10 | 0;
	var timeMinOne = timeMin % 10 | 0;
	var timeSec = (fr / 25) % 60;
	var timeSecTen = timeSec / 10 | 0;
	var timeSecOne = timeSec % 10 | 0;
	var timeFr = (fr) % 25;
	var timeFrTen = timeFr / 10 | 0;
	var timeFrOne = timeFr % 10 | 0;
	var bufdata = new Buffer([
		timeFrOne, // bits 0-7
		timeFrTen, // bits 8-15
		timeSecOne, // bits 16-23
		timeSecTen, // bits 24-31
		timeMinOne, // bits 32-39
		timeMinTen, // bits 40-47
		timeHourOne, // bits 48-55
		timeHourTen, // bits 56-63
		0b11111100, // bits 64-71, sync word
		0b10111111, // bits 72-79, sync word
	]);
	// Apply phase correction
	var phaseCorrection = 8;
	// Bytes 9 and 10 always have an odd amount of 1s, skip them
	for(var i=0; i<8; i++) for(var j=0; j<8; j++){
		if(bufdata[i] & (1<<j)) phaseCorrection^=8;
	}
	bufdata[3] |= phaseCorrection;
	return bufdata;
}


module.exports.toEncoded = toEncoded;
function toEncoded(buf, state){
	var out = new Buffer(buf.length*2);
	out.fill();
	for(var i=0; i<buf.length*8; i++){
		var value = getBit(buf, i);
		// state must cross at new bit
		state ^= 1;
		writeBit(out, i*2, state);
		// state will cross again iff bit is on
		state ^= value;
		writeBit(out, i*2+1, state);
	}
	return out;
}

module.exports.smpteEncode = smpteEncode;
function smpteEncode(){
	this.bitDepth = 16;
	this.channels = 2;
	this.sampleRate = 44100;
	this.samplesGenerated = 0;
	this.lastValue = 0;
	Readable.apply(this, arguments);
}

smpteEncode.prototype = Object.create(Readable.prototype);
smpteEncode.prototype.constructor = smpteEncode;
smpteEncode.prototype.speakerOpts = function speakerOpts(){
	return {
		channels:smpteEncode.channels,
		sampleRate:smpteEncode.sampleRate,
		signed:true
	};
};
smpteEncode.prototype._read = function _read(n) {
	var stream = this;
	var channels = {
		0: {getFrame: function(samples){ return samples/stream.sampleRate*25;  }},
		1: {getFrame: function(samples){ return samples/stream.sampleRate*25/2;  }}, // this one is playing at half speed
	};
	var sampleSize = this.bitDepth / 8;
	var blockSize = sampleSize * stream.channels;
	var numSamples = n / blockSize | 0;
	var audio = new Buffer(numSamples * blockSize);
	var amplitude = 32760; // Max amplitude for 16-bit audio

	for (var i = 0; i < numSamples; i++) {
		var s = stream.samplesGenerated + i;
		for (var chanId = 0; chanId<stream.channels; chanId++) {
			var channel = channels[chanId];
			var frfloat = channel.getFrame(s);
			var frno = frfloat |0;
			var bit = (frfloat*160 |0) % 160;
			if(channel.currentFrame!==frno){
				channel.data = toEncoded(generateFrame(frno), 0);
				//console.log(chanId+('    '+frno).substr(-5) + ' ' + asBinary(channel.data));
				channel.currentFrame = frno;
			}
			var value = getBit(channel.data, bit);
			// fill with a simple sine wave at max amplitude
			var lastValue = channel.lastValue || 0;
			var val = Math.round( (amplitude*(value ? -0.7 : +0.7)) + lastValue*0.2 );
			channel.lastValue = val;
			var offset = (i * sampleSize * stream.channels) + (chanId * sampleSize);
			audio['writeInt' + stream.bitDepth + 'LE'](val, offset);
		}
	}
	stream.push(audio);
	stream.samplesGenerated += numSamples;
}