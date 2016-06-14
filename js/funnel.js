'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
* Connection and redis libraries
*/
var net = require('net');
var Redis = require('ioredis');
var redis_client = new Redis();

console.log('We began baby!');
/**
* Sends Messages to the matching server.
*/
var send_msg = function send_msg(msg) {
	console.log('Sending to matching: ');
	console.log(JSON.stringify(msg));
	redis_client.multi().rpush('messages', JSON.stringify(msg)).exec(function (err, results) {});
};

/**
* Clients holder
*/
var clients = {};

var Client = function () {
	/*
 * Client 'A' always refers to the client who either requested the information.
 * or whose the result is intended for. Client 'B' refers to a client who is
 * not the main goal of the message but somehow the message involves him. This
 * applies in every JSON message sent.
 */

	function Client(guid, longitude, latitude, socket) {
		_classCallCheck(this, Client);

		this.guid = guid;
		this.longitude = longitude;
		this.latitude = latitude;
		this.socket = socket;
		this.functions_dictionary = {
			'both_accepted': function a(data_received) {
				Client.both_clients_accepted(data_received);
			}.bind(this),
			'clients_matched': function b(data_received) {
				Client.clients_matched(data_received);
			}.bind(this),
			'connection_not_accepted': function c(data_received) {
				Client.connection_not_accepted(data_received);
			}.bind(this),
			'try_to_match': function d(data_received) {
				this.try_to_match_local(data_received);
			}.bind(this),
			'accepted': function e(data_received) {
				this.accepted(data_received);
			}.bind(this),
			'send_both_back_into_matching': function f(data_received) {
				this.send_both_back_into_matching(data_received);
			}.bind(this),
			'flag_other_user': function g(data_received) {
				this.flag_other_user(data_received);
			}.bind(this),
			'send_data_to_partner': function h(data_received) {
				this.send_data_to_partner(data_received);
			}.bind(this),
			'not_initiator_call_started': function i(data_received) {
				this.not_initiator_call_started(data_received);
			}.bind(this)
		};
	}

	/*
 * All of the static methods are methods called because of an action of
 * the matching server. Is usually as a response to a request used by a
 * client.
 */


	_createClass(Client, [{
		key: 'try_to_match_local',


		/*
  * The following methods are used by the clients in order to communicate with the matching server.
  */
		value: function try_to_match_local(data_received) {
			var data = { 'type': 'try_to_match', 'id': this.guid, 'latitude': this.latitude, 'longitude': this.longitude };
			send_msg(data);
		}
	}, {
		key: 'accepted',
		value: function accepted(data_received) {
			send_msg({ 'type': 'accepted', 'id': this.guid });
		}
	}, {
		key: 'send_both_back_into_matching',
		value: function send_both_back_into_matching(data_received) {
			send_msg({ 'type': 'send_both_back_into_matching', 'content': 'nothing' });
		}
	}, {
		key: 'flag_other_user',
		value: function flag_other_user(data_received) {
			send_msg({ 'type': 'flag_other_user', 'id': tmp_guid });
		}

		/*
  * The following methods are used by the clients in order to communicate with other client.
  */

	}, {
		key: 'send_data_to_partner',
		value: function send_data_to_partner(data_received) {
			clients[data_received['person_b']].socket.write(JSON.stringify({ 'type': 'partner_data', 'content': data_received['content'] }));
		}
	}, {
		key: 'not_initiator_call_started',
		value: function not_initiator_call_started(data_received) {
			clients[data_received['person_b']].socket.write(JSON.stringify({ 'type': 'call_now' }));
		}

		/*
  * Entry point for calling every function
  */

	}, {
		key: 'execute_function',
		value: function execute_function(data_received) {
			if (this.functions_dictionary.hasOwnProperty(data_received['type'])) this.functions_dictionary[data_received['type']](data_received);else console.log(data_received['type'] + ' not recognized as a function');
		}
	}], [{
		key: 'both_clients_accepted',
		value: function both_clients_accepted(data_received) {
			clients[data_received['person_a']].socket.write(JSON.stringify({ 'type': 'both_accepted' }));
			clients[data_received['person_b']].socket.write(JSON.stringify({ 'type': 'both_accepted' }));
		}
	}, {
		key: 'clients_matched',
		value: function clients_matched(data_received) {
			console.log('Sending messages to the clients that they matched');
			console.log(data_received['person_a']);
			console.log(clients[data_received['person_a']]);
			clients[data_received['person_a']].socket.write(JSON.stringify({ 'type': 'clients_matched', 'content': data_received['person_b'], 'initiate': 'true' }));
			clients[data_received['person_b']].socket.write(JSON.stringify({ 'type': 'clients_matched', 'content': data_received['person_a'], 'initiate': 'false' }));
		}
	}, {
		key: 'connection_not_accepted',
		value: function connection_not_accepted(data_received) {
			clients[data_received['person_a']].socket.write(JSON.stringify({ 'type': 'connection_not_accepted', 'content': 'You have been flagged two times or more.' }));
		}
	}, {
		key: 'person_was_flagged',
		value: function person_was_flagged(data_received) {
			clients[data_received['person_a']].socket.write(JSON.stringify({ 'type': 'person_was_flagged', 'content': 'You have been flagged' }));
		}
	}]);

	return Client;
}();

/**
* Socket Server Entry Point
*/


var server = net.createServer(function (socket) {
	var tmp_guid = '';

	socket.on('end', function () {
		send_msg({ 'type': 'disconnected', 'id': tmp_guid });
		delete clients[tmp_guid];
	});

	socket.on('data', function (data) {
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
				console.log(data_received);
				if (!clients.hasOwnProperty(data_received['id']) && data_type == 'try_to_match') {
					tmp_guid = data_received['id'];
					clients[data_received['id']] = new Client(data_received['id'], data_received['longitude'], data_received['latitude'], socket);
				} else if (!clients.hasOwnProperty(data_received['id']) && data_received['id'] != 'MASTER_PYTHON') {
					return false;
				}
				else if(!clients.hasOwnProperty(data_received['id'])) {
				tmp_guid = data_received['id'];
				clients[data_received['id']] = new Client(data_received['id'], '0.0', '0.0', socket);
				}
				// Every type of message has an associated function.
				// If not then it would throw an error.
				clients[data_received['id']].execute_function(data_received);
			} //end of if
		} // end of for
	}); // End of data listener
}).listen(8124);

/**
* Author: Jesus Andres Castaneda Sosa, 2016
*/
