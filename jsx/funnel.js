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


In case that the conversation from twilio  is lost. the person should try to get back into matching.
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
    // Now write back to the client with the token information.
    let data_to_send = {'type': 'connection_received', 'token' : token.toJwt(), 'identity' : tmp_guid};
	socket.write(JSON.stringify(data_to_send));
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
						console.log('MASTER PYTHON HAS SAID SOMETHING TO ME');
						clients[data_received['person_a']]['socket'].write(JSON.stringify({'type':'matched_with', 'content': data_received['person_b'], 'initiate': 'true'}));
						clients[data_received['person_b']]['socket'].write(JSON.stringify({'type':'matched_with', 'content': data_received['person_a'], 'initiate': 'false'}));
						break;
					case 'connection_not_accepted':
						console.log('MASTER PYTHON HAS SAID SOMETHING TO ME');
						// this happens if the user has two flags or more.
						clients[data_received['id']]['socket'].write(JSON.stringify({'type': 'connection_not_accepted', 'content': 'You have been flagged two times or more.'}));
					case 'send_both_back_into_matching':
						console.log('MASTER PYTHON HAS SAID SOMETHING TO ME');
						// clients[data_received['person_a']]['socket'].write(JSON.stringify({'type':'close_conversation','content': 'You just matched the other person.'}));
						send_msg({'type' : 'send_both_back_into_matching', 'content': 'nothing'})
					case 'flag_other_user':
						send_msg({'type' : 'flag_other_user', 'id':tmp_guid});
						break;
					case 'send_data_to_partner':
						/* This works for the phonertc server */
						clients[data_received['person_a']]['socket'].write(JSON.stringify({'type' : 'partner_data', 'content': data_received['content']}));
						break;
					case "not_initiator_call_started":
						clients[data_received['person_a']]['socket'].write(JSON.stringify({'type' : 'call_now', 'content': data_received['content']}));
						break;
					default:
						console.log('Type not recognized');
				} // end of switch
			} //end of if
		} // end of for
	});
}).listen(8124);