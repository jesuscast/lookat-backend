"use strict";

// Requirements.
var net = require("net");

// Global variable containing all the clients.
var clients = {};

// Global variables for Twilio. At the moment I am using Twilio but fuck that in the future.

var account_sid = "AC5e8ed5029d7539d496c3e8fd538e10fd";
var api_key = "SK9c30753a41ccb5a9f21be736384866db";
var api_secret = "WyuKvPxehyA5YzFRDTm3X2PsRjq2LC92";
var configuration_profile_sid = "VS4b07a03bb48f5d33c988e466f9be30bb";

var AccessToken = require('twilio').AccessToken;
var ConversationsGrant = AccessToken.ConversationsGrant;

// Utility to generate uuid
var guid = function guid() {
	var s4 = function s4() {
		return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
	};
	return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
};

// Matching client that talks to the other process.
var matching_client = net.connect({ port: 8125 }, function () {
	// 'connect' listener
	console.log('connected to server!');
});

var connection_made = function connection_made(tmp_guid, socket) {
	// Create the token
	var token = new AccessToken(account_sid, api_key, api_secret);
	// Save the identity
	token.identity = tmp_guid;
	// Create the grant.
	var grant = new ConversationsGrant();
	grant.configurationProfileSid = configuration_profile_sid;
	// Add the grant to the token.
	token.addGrant(grant);
	// Save this into the array of clients.
	clients[tmp_guid] = { 'socket': socket, 'grant': grant, 'token': token, 'identity': tmp_guid };
	// Now write back to the client with the token information.
	var data_to_send = { 'type': 'connection_received', 'token': token.toJwt(), 'identity': tmp_guid };
	socket.write(JSON.stringify(data_to_send));
};

// Twilio Information.

var server = net.createServer(function (socket) {
	// This happens whenever it connects for the first time.
	var tmp_guid = guid();
	connection_made(tmp_guid, socket);
	// Whenever somebody disconnects
	// Remove the client from the list when it leaves
	socket.on('end', function () {
		// clients.splice(clients.indexOf(socket), 1);
		delete clients[tmp_guid];
		//broadcast(socket.name + " left.\n");
	});

	socket.on('data', function (data) {
		var data_received = JSON.parse(data.toString().replace('\n', ''));
		console.log(data_received);
		// Loop over the types in order to find the correct response
		if (data_received.hasOwnProperty('type')) {
			var data_type = data_received['type'];
			switch (data_type) {
				case 'join':
					console.log('Sombody is trying to join');
					matching_client.emit('join', tmp_guid, data_received);
					break;
				case 'try_to_match':
					console.log('Sombody is trying to match');
					matching_client.emit('try_to_match', tmp_guid, data_received);
					break;
				case 'accepted':
					console.log('Sombody accepted');
					matching_client.emit('accepted', tmp_guid, data_received);
					break;
				case 'back_into_queue':
					console.log('Somebody is trying to get back into queue');
					break;
			} // end of switch
		}
	});
}).listen(8123);

matching_client.on('data', function (data) {
	var data_received = JSON.parse(data);
	var data_to_send = {};
	if (data_received.hasOwnProperty('type')) {
		var data_type = data_received['type'];
		if (data_received.hasOwnProperty('content')) {
			var data_content = data_received['content'];
			if (data_received.hasOwnProperty('id')) {
				var data_id = data_received['id'];
				switch (data_type) {
					case 'matched_with':
						console.log('I got somebody that I matched with');
						// From python: msg_first = {'type':'matched', 'content' : matched_with.name, 'token': redis_server.hget(current_client.name, 'token'), 'send_to' : current_client.name, 'role' : 'send_invite'};
						data_to_send = { 'type': 'matched', 'content': data_content, 'role': 'send_invite' };
						clients[data_id]['socket'].write(JSON.stringify(data_to_send));
						break;
					case 'both_people_accepted':
						var data_to_send = { 'type': 'continue_conversation', 'content': 'Nothing' };
						clients[data_id]['socket'].write(JSON.stringify(data_to_send));
						data_to_send = { 'type': 'continue_conversation', 'content': 'Nothing' };
						clients[data_content]['socket'].write(JSON.stringify(data_to_send));
						break;
					default:
						console.log('type not identified');
						console.log(data_type);
				} // end of switch
			} else {
					console.log('no id');
				} // end id
		} else {
				console.log(' no content');
			} // end content
	} else {
			console.log('no type');
		} // end type
});

matching_client.on('end', function () {
	console.log('disconnected from server');
});
matching_client.on('try_to_match', function (tmp_guid, data_received) {
	var data_to_send = { 'type': 'try_to_match', 'content': data_received, 'id': tmp_guid };
	matching_client.write(JSON.stringify(data_to_send));
});

matching_client.on('join', function (tmp_guid, data_received) {
	var data_to_send = { 'type': 'join', 'content': data_received, 'id': tmp_guid };
	matching_client.write(JSON.stringify(data_to_send));
});

matching_client.on('accepted', function (tmp_guid, data_received) {
	var data_to_send = { 'type': 'accepted', 'content': data_received, 'id': tmp_guid };
	matching_client.write(JSON.stringify(data_to_send));
});