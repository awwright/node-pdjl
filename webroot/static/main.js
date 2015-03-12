var Body = React.createClass({
	getInitialState: function() {
		console.log('init Body');
		return {connectionStatus: 'Connecting...'};
	},
	componentDidMount: function() {
		var self = this;
		this.wsc = new WebSocket('ws://localhost:8080/');
		this.wsc.onopen = function(evt) { self.setState({connectionStatus:'Open'}); };
		this.wsc.onclose = function(evt) { self.setState({connectionStatus:'Close'}); };
		this.wsc.onmessage = function(evt) { self.setState({connectionStatus:JSON.stringify(evt.data)}); };
		this.wsc.onerror = function(evt) { self.setState({connectionStatus:'Error'}); };
	},
	componentWillUnmount: function() {
		this.wsc.close();
	},
	render: function() {
		return React.DOM.div({}, [
			React.DOM.h1(null, this.state.connectionStatus),
			React.DOM.div({}, [
				React.createElement(CDJ, {channel:1}),
				React.createElement(CDJ, {channel:2}),
				React.createElement(CDJ, {channel:3}),
				React.createElement(CDJ, {channel:4}),
			])
		])
	}
});

var CDJ = React.createClass({
	getInitialState: function() {
		console.log('init Body');
		return {secondsElapsed: 0};
	},
	tick: function() {
		this.setState({secondsElapsed: this.state.secondsElapsed + 1});
	},
	componentDidMount: function() {
		this.interval = setInterval(this.tick, 1000);
	},
	componentWillUnmount: function() {
		clearInterval(this.interval);
	},
	render: function() {
		return React.DOM.div({className:'CDJ'}, [
			React.DOM.h1(null, 'CDJ.'+this.props.channel),
		])
	}
});

document.addEventListener("DOMContentLoaded", function(event) {
	console.log('Loaded');
});

window.onload = function(){
	console.log('onload');
	React.render(React.createElement(Body, {}), document.getElementsByTagName('body')[0]);
}

console.log('main.js');
