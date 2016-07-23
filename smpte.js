
var smpte = require('./smptedata.js');
var Speaker = require('speaker');
var smpteEncode = new smpte.smpteEncode();
var speaker = new Speaker(smpteEncode.speakerOpts());
smpteEncode.pipe(speaker);
