var Readable = require('stream').Readable;

var smpteData = new Readable();
smpteData.framerate = 25;
smpteData.framesGenerated = 0;
smpteData._read = function(){
	var fr = this.framesGenerated++;
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
	var buf = new Buffer([
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
  this.push(buf);
//	return [
//		timeHourTen,
//		timeHourOne,
//		timeMinTen,
//		timeMinOne,
//		timeSecTen,
//		timeSecOne,
//		timeFrTen,
//		timeFrOne,
//	];
};


// the frequency to play
var freq = parseFloat(process.argv[2], 10) || 440.0; // Concert A, default tone

// seconds worth of audio data to generate before emitting "end"
var duration = parseFloat(process.argv[3], 10) || 2.0;

console.log('generating a %dhz sine wave for %d seconds', freq, duration);

// A SineWaveGenerator readable stream
var smpteEncode = new Readable();
smpteEncode.bitDepth = 16;
smpteEncode.channels = 1;
smpteEncode.sampleRate = 44100;
smpteEncode.samplesGenerated = 0;
smpteEncode.lastValue = 0;
smpteEncode._read = read;

function asBinary(buf){
	var s = '';
	for(var i=0; i<buf.length; i++){
		for(var j=0; j<8; j++) s += ((buf[i]>>j)&1) ? '-' : '_';
	}
	return s;
}

function getBit(buf, offset){
	var byte = offset/8 |0;
	var bit = offset%8;
	return (buf[byte]>>bit) & 1;
}
function writeBit(buf, offset, val){
	var byte = offset/8 |0;
	var bit = offset%8;
	if(val){
		buf[byte] |= (1<<bit);
	}else{
		buf[byte] &= buf[byte]^(1<<bit);
	}
}
function toManchester(buf, state){
	var manchester = new Buffer(buf.length*2);
	manchester.fill();
	for(var i=0; i<buf.length*8; i++){
		var value = getBit(buf, i);
		// state must cross at new bit
		state ^= 1;
		writeBit(manchester, i*2, state);
		// state will cross again iff bit is on
		state ^= value;
		writeBit(manchester, i*2+1, state);
	}
	return manchester;
}
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
	for(var i=0; i<8; i++) for(var j=0; j<8; j++){
		if(bufdata[i] & (1<<j)) phaseCorrection^=8;
	}
	bufdata[3] |= phaseCorrection;
	return bufdata;
}

function read (n) {
	var manchesterFrame = null;
	var manchester = null;

	var sampleSize = this.bitDepth / 8;
	var blockSize = sampleSize * this.channels;
	var numSamples = n / blockSize | 0;
	var audio = new Buffer(numSamples * blockSize);
	var amplitude = 32760; // Max amplitude for 16-bit audio

	for (var i = 0; i < numSamples; i++) {
		var freq = 25;
		var s = this.samplesGenerated + i;
		var frno = s/this.sampleRate*freq |0;
		var bit = (s/this.sampleRate*freq*160 |0) % 160;
		if(manchesterFrame!==frno){
			var manchester = toManchester(generateFrame(frno), 0);
			//console.log(('    '+frno).substr(-5) + ' ' + asBinary(manchester));
			var manchesterFrame = frno;
		}
		var value = getBit(manchester, bit);
		// fill with a simple sine wave at max amplitude
		var val = Math.round( (amplitude*(value ? -0.7 : +0.7)) + this.lastValue*0.2 );
		this.lastValue = val;
		for (var channel = 0; channel < this.channels; channel++) {
			var offset = (i * sampleSize * this.channels) + (channel * sampleSize);
			audio['writeInt' + this.bitDepth + 'LE'](val, offset);
		}
	}
	this.push(audio);

	this.samplesGenerated += numSamples;

}


var Speaker = require('speaker');
var speaker = new Speaker({channels:smpteEncode.channels, sampleRate:smpteEncode.sampleRate, signed:true});
smpteEncode.pipe(speaker);

