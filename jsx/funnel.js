/**
* Connection and redis libraries
*/
const net = require('net')
let Redis = require('ioredis')
let redis_client = new Redis()

console.log('We began baby!')
/**
* Sends Messages to the matching server.
*/
let send_msg = (msg) => {
	console.log('Sending to matching: ')
	console.log(JSON.stringify(msg))
	redis_client.multi()
		.rpush('messages', JSON.stringify(msg))
		.exec(function (err, results) {

	})
}

/**
* Clients holder
*/
let clients = {}
 
class Client {
	/*
	* Client 'A' always refers to the client who either requested the information.
	* or whose the result is intended for. Client 'B' refers to a client who is
	* not the main goal of the message but somehow the message involves him. This
	* applies in every JSON message sent.
	*/
	constructor(guid, longitude, latitude, socket) {
		this.guid = guid
		this.longitude = longitude
		this.latitude = latitude
		this.socket = socket
		this.functions_dictionary = {
			'both_accepted': 				function a(data_received){  Client.both_clients_accepted(data_received) }.bind(this),
			'clients_matched':  			function b(data_received){ Client.clients_matched(data_received) }.bind(this),
			'connection_not_accepted': 		function c(data_received){  Client.connection_not_accepted(data_received) }.bind(this),
			'try_to_match': 				function d(data_received){ this.try_to_match_local(data_received) }.bind(this),
			'accepted': 					function e(data_received){ this.accepted(data_received) }.bind(this),
			'send_both_back_into_matching': function f(data_received){ this.send_both_back_into_matching(data_received) }.bind(this),
			'flag_other_user': 				function g(data_received){ this.flag_other_user(data_received) }.bind(this),
			'send_data_to_partner': 		function h(data_received){ this.send_data_to_partner(data_received) }.bind(this),
			'not_initiator_call_started': 	function i(data_received){ this.not_initiator_call_started(data_received) }.bind(this),
		}
	}

	/*
	* All of the static methods are methods called because of an action of
	* the matching server. Is usually as a response to a request used by a
	* client.
	*/
	static both_clients_accepted(data_received){
		clients[data_received['person_a']].socket.write(JSON.stringify({'type':'both_accepted'}));
		clients[data_received['person_b']].socket.write(JSON.stringify({'type':'both_accepted'}));
	}

	static clients_matched(data_received){
		clients[data_received['person_a']].socket.write(JSON.stringify({'type':'matched_with', 'content': data_received['person_b'], 'initiate': 'true'}));
		clients[data_received['person_b']].socket.write(JSON.stringify({'type':'matched_with', 'content': data_received['person_a'], 'initiate': 'false'}));
	}

	static connection_not_accepted(data_received){
		clients[data_received['person_a']].socket.write(JSON.stringify({'type': 'connection_not_accepted', 'content': 'You have been flagged two times or more.'}));
	}

	static person_was_flagged(data_received){
		clients[data_received['person_a']].socket.write(JSON.stringify({'type': 'person_was_flagged', 'content' : 'You have been flagged'}));
	}

	/*
	* The following methods are used by the clients in order to communicate with the matching server.
	*/
	try_to_match_local(data_received){
		let data = {'type':'try_to_match', 'id': this.guid, 'latitude': this.latitude, 'longitude': this.longitude}
		send_msg(data)
	}

	accepted(data_received){
		send_msg({'type': 'accepted', 'id' : this.guid})
	}

	send_both_back_into_matching(data_received){
		send_msg({'type' : 'send_both_back_into_matching', 'content': 'nothing'})
	}

	flag_other_user(data_received){
		send_msg({'type' : 'flag_other_user', 'id':tmp_guid});
	}

	/*
	* The following methods are used by the clients in order to communicate with other client.
	*/
	send_data_to_partner(data_received){
		clients[data_received['person_b']].socket.write(JSON.stringify({'type' : 'partner_data', 'content': data_received['content']}));
	}

	not_initiator_call_started(data_received){
		clients[data_received['person_b']].socket.write(JSON.stringify({'type' : 'call_now'}));
	}

	/*
	* Entry point for calling every function
	*/
	execute_function(data_received){
		if(this.functions_dictionary.hasOwnProperty(data_received['type']))
			this.functions_dictionary[data_received['type']](data_received)
		else
			console.log(data_received['type']+' not recognized as a function')
	}
}

/**
* Socket Server Entry Point
*/
let server = net.createServer((socket) => {
	let tmp_guid = ''

	socket.on('end', () => {
		send_msg({'type':'disconnected', 'id': tmp_guid})
		delete clients[tmp_guid]
	})

	socket.on('data', (data) => {
		let string_of_data = data.toString()
		// Check if there are multiple messages bundled together.
		let array_of_messages = []
		if(string_of_data.indexOf('}{') != -1) {
			array_of_messages = string_of_data.split('}{')
			for(let i = 0; i < array_of_messages.length; i++) {
				if(i > 0)
					array_of_messages[i] = '{' + array_of_messages[i]
				if(i < (array_of_messages.length - 1))
					array_of_messages[i] += '}'
			}
		} else {
			array_of_messages.push(string_of_data)
		}
		for(let i = 0; i < array_of_messages.length; i++) {
			let data_received = JSON.parse(array_of_messages[i].replace('\n',''))
			// Loop over the types in order to find the correct response
			if( data_received.hasOwnProperty('type') ){
				let data_type = data_received['type']
				if(!clients.hasOwnProperty(data_received['id']) && data_type == 'try_to_match'){
					tmp_guid = data_received['id']
					clients[data_received['id']] = new Client(data_received['id'], data_received['longitude'], data_received['latitude'], socket)
				} else if(!clients.hasOwnProperty(data_received['id'])) {
					return false
				}
				// Every type of message has an associated function.
				// If not then it would throw an error.
				clients[data_received['id']].execute_function(data_received)
			} //end of if
		} // end of for
	}) // End of data listener
}).listen(8124)



/**
* Author: Jesus Andres Castaneda Sosa, 2016
*/