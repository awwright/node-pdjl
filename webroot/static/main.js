var Body = React.createClass({
	getInitialState: function() {
		console.log('init Body');
		return {
			connectionStatus: 'Connecting...',
			lastMessage: '',
			cdjData: [{},{},{},{}],
		};
	},
	componentDidMount: function() {
		var self = this;
		this.wsc = new WebSocket('ws://localhost:8080/');
		this.wsc.onopen = function(evt) { self.setState({connectionStatus:'Open'}); };
		this.wsc.onclose = function(evt) { self.setState({connectionStatus:'Close'}); };
		this.wsc.onmessage = function(evt) {
			console.log(evt.data);
			var data = JSON.parse(evt.data);
			var cdjs = self.state.cdjData.slice();
			cdjs[data.channel-1] = data;
			self.setState({cdjData: cdjs});
		};
		this.wsc.onerror = function(evt) { self.setState({connectionStatus:'Error'}); };
	},
	send: function(d){
		this.wsc.send(JSON.stringify(d));
	},
	componentWillUnmount: function() {
		this.wsc.close();
	},
	render: function() {
		var self = this;
		return React.DOM.div({}, [
			React.DOM.h1(null, this.state.connectionStatus),
			React.DOM.div({}, this.state.cdjData.map(function(cdj){
				return React.createElement(CDJ, {data:cdj, onEvent:self.send.bind(self)});
			})),
		]);
	},
});

var CDJ = React.createClass({
	getInitialState: function() {
		console.log('init CDJ');
		return {};
	},
	handleStartStop: function(e){
		if(this.props.data.state===3){
			// Now playing, stop
			this.props.onEvent({type:'startStop', channel:this.props.data.channel, value:1});
		}else{
			// Now stopped, start
			this.props.onEvent({type:'startStop', channel:this.props.data.channel, value:0});
		}
	},
	render: function() {
		return React.DOM.div({className:'CDJ'}, [
			React.DOM.h1(null, 'CDJ.'+this.props.data.channel),
			React.DOM.div(null, this.props.data.stateStr),
			React.DOM.button({onClick:this.handleStartStop}, 'start/stop'),
			React.DOM.pre({}, JSON.stringify(this.props.data,null,' ')),
		]);
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
