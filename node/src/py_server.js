// Requirements.
const net = require("net");
let Redis = require('ioredis');
let redis_client = new Redis();
/*

First message

{"type": "uuid_received", "content": "asdasd"}

Second Message

{"lat": 2, "type": "join", "long": 3}

Third Message:
{"type": "try_to_match"}

Fourth Message #1:
{"type": "accepted", "id": }
*/
let send_msg = (msg) => {
	redis_client.multi()
		.rpush("messages", JSON.stringify(msg))
		.exec(function (err, results) {
	  // results === [[null, 'OK'], [null, 'bar']]
	  		console.log(results);
	});
};
// Global variable containing all the clients.
let clients = {};

// Global variables for Twilio. At the moment I am using Twilio but fuck that in the future.

let account_sid = "AC5e8ed5029d7539d496c3e8fd538e10fd"
let api_key = "SK9c30753a41ccb5a9f21be736384866db"
let api_secret = "WyuKvPxehyA5YzFRDTm3X2PsRjq2LC92"
let configuration_profile_sid = "VS4b07a03bb48f5d33c988e466f9be30bb"

let AccessToken = require('twilio').AccessToken;
let ConversationsGrant = AccessToken.ConversationsGrant;

// Utility to generate uuid
let guid = () => {
	let s4 = () => {
		return Math.floor((1 + Math.random()) * 0x10000)
	      .toString(16)
	      .substring(1);
	};
	return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
    s4() + '-' + s4() + s4() + s4();
};

let connection_made = (tmp_guid, socket) => {
	// Create the token
	let token = new AccessToken(
        account_sid,
        api_key,
        api_secret
    );
	// Save the identity
    token.identity = tmp_guid;
    // Create the grant.
    let grant = new ConversationsGrant();
    grant.configurationProfileSid = configuration_profile_sid;
    // Add the grant to the token.
    token.addGrant(grant);
    // Save this into the array of clients.
    clients[tmp_guid] = {'socket':socket, 'grant':grant,'token':token, 'identity' : tmp_guid};
    if(clients[tmp_guid].hasOwnProperty('user_flagged')) {
    	if(parseInt(clients[tmp_guid]['user_flagged']) < 2){
    		let data_to_send = {'type': 'connection_received', 'token' : token.toJwt(), 'identity' : tmp_guid};
			socket.write(JSON.stringify(data_to_send));
    	} else {
    		let data_to_send = {'type': 'you_have_been_flagged'};
			socket.write(JSON.stringify(data_to_send));
    	}
    } else {
    	clients[tmp_guid]['user_flagged'] = (0).toString();
    	let data_to_send = {'type': 'connection_received', 'token' : token.toJwt(), 'identity' : tmp_guid};
		socket.write(JSON.stringify(data_to_send));
    };
    // Now write back to the client with the token information.
};

// Twilio Information.

let server = net.createServer((socket) => {
	// Whenever somebody disconnects
	// Remove the client from the list when it leaves
	let tmp_guid = '';
	let joined_already = false;
	socket.on('end', () => {
		delete clients[tmp_guid];
		send_msg({'type':'disconnected', 'id': tmp_guid});
	});

	socket.on('data', (data) => {
		let string_of_data = data.toString();
		// Check if there are multiple messages bundled together.
		let array_of_messages = []
		if(string_of_data.indexOf('}{') != -1) {
			array_of_messages = string_of_data.split('}{');
			for(let i = 0; i < array_of_messages.length; i++) {
				if(i > 0)
					array_of_messages[i] = '{' + array_of_messages[i]
				if(i < (array_of_messages.length - 1))
					array_of_messages[i] += '}'
			}
		} else {
			array_of_messages.push(string_of_data);
		}
		for(let i = 0; i < array_of_messages.length; i++) {
			let data_received = JSON.parse(array_of_messages[i].replace('\n',''));
			// Loop over the types in order to find the correct response
			if( data_received.hasOwnProperty('type') ){
				let data_type = data_received['type'];
				switch(data_type) {
					case 'uuid_received':
						tmp_guid = data_received['content'];
						console.log('uuid_received from: '+tmp_guid);
						connection_made(tmp_guid, socket);
						break;
					case 'join':
						/*
							Join expects the coordinates already sent in the body
						*/
						if(! joined_already) {
							console.log('join from: '+tmp_guid);
							send_msg({'type': 'join', 'id': tmp_guid, 'lat': data_received['lat'], 'long': data_received['long']});
							joined_already = true;
						}
						else {
							console.log('NOT ACCEPTED from: '+tmp_guid);
						}
						break;
					case 'try_to_match':
						console.log('try_to_match from: '+tmp_guid);
						send_msg({'type':'try_to_match', 'id': tmp_guid});
						// matching_client.emit('try_to_match', tmp_guid, data_received);
						break
					case 'accepted':
						console.log('accepted from: '+tmp_guid);
						send_msg({'type': 'accepted', 'id': tmp_guid});
						// matching_client.emit('accepted', tmp_guid, data_received);
						break;
					case 'both_accepted':
						console.log('MASTER PYTHON AS SAID SOMETHING TO ME ABOUT ACCEPTED');
						clients[data_received['person_a']]['socket'].write(JSON.stringify({'type':'both_accepted'}));
						clients[data_received['person_b']]['socket'].write(JSON.stringify({'type':'both_accepted'}));
						// break;
					case 'matched_with':
						console.log('MASTER PYTHON AS SAID SOMETHING TO ME');
						clients[data_received['person_a']]['socket'].write(JSON.stringify({'type':'matched_with', 'content': data_received['person_b']}));
						break;
					case 'flag_user':
						break;
				} // end of switch
			} //end of if
		} // end of for
	});
}).listen(8124);