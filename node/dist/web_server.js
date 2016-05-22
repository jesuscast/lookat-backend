'use strict';

var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var net = require("net");
// Matching client that talks to the other process.

app.get('/', function (req, res) {
	res.sendFile(__dirname + '/index.html');
});

app.get('/web_client.js', function (req, res) {
	res.sendFile(__dirname + '/web_client.js');
});

function encode_utf8(s) {
	return unescape(encodeURIComponent(s));
}

io.on('connection', function (socket) {
	console.log('a user connected');
	// 104.236.141.41 is my digitalocean server.
	var server_connection = net.connect({ port: 8124, host: '104.236.141.41' }, function () {
		// 'connect' listener
		console.log('connected to server using this particular user.!');
	});

	socket.on("uuid_received", function (data) {
		console.log("uuid_received");
		console.log(data);
		server_connection.write(data);
	});

	socket.on("join", function (data) {
		console.log("trying to join");
		console.log(data);
		server_connection.write(data);
	});

	socket.on("try_to_match", function (data) {
		console.log("try_to_match");
		console.log(data);
		server_connection.write(data);
	});

	server_connection.on("data", function (data) {
		var string_of_data = data.toString();
		// Check if there are multiple messages bundled together.
		var array_of_messages = [];
		if (string_of_data.indexOf('}{') != -1) {
			array_of_messages = string_of_data.split('}{');
			for (var i = 0; i < array_of_messages.length; i++) {
				if (i > 0) array_of_messages[i] = '{' + array_of_messages[i];
				if (i < array_of_messages.length - 1) array_of_messages[i] += '}';
			}
		} else {
			array_of_messages.push(string_of_data);
		}
		for (var _i = 0; _i < array_of_messages.length; _i++) {
			var data_received = JSON.parse(array_of_messages[_i].replace('\n', ''));
			// Loop over the types in order to find the correct response
			if (data_received.hasOwnProperty('type')) {
				var data_type = data_received['type'];
				switch (data_type) {
					case "connection_received":
						console.log("Connection received");
						socket.emit("connection_received", array_of_messages[_i]);
						break;
					case "ready_to_match":
						console.log('ready_to_match');
						var msg = {
							"type": "try_to_match"
						};
						server_connection.write(JSON.stringify(msg));
						break;
					case "matched":
						console.log("Matched");
						socket.emit("matched", array_of_messages[_i]);
						break;
					default:
						console.log(data_received['type']);
						console.log("Type nor supported");
				} //end switch
			} // end if
		} // end for
	});
});

http.listen(3000, function () {
	console.log('listening on *:3000');
});