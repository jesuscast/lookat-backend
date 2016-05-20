// Requirements.
const net = require("net");

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


// Matching client that talks to the other process.
const matching_client = net.connect({port: 8125}, () => {
	// 'connect' listener
	console.log('connected to server!');
});

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
	socket.on('end', () => {
		// clients.splice(clients.indexOf(socket), 1);
		// delete clients[tmp_guid];
		matching_client.emit('client_disconnected', tmp_guid);
		//broadcast(socket.name + " left.\n");
	});

	socket.on('data', (data) => {
		let data_received = JSON.parse(data.toString().replace('\n',''));
		console.log(data_received);
		// Loop over the types in order to find the correct response
		if( data_received.hasOwnProperty('type') ){
			let data_type = data_received['type'];
			switch(data_type) {
				case 'join':
					console.log('Sombody is trying to join');
					matching_client.emit('join', tmp_guid, data_received);
					break;
				case 'try_to_match':
					console.log('Sombody is trying to match');
					matching_client.emit('try_to_match', tmp_guid, data_received);
					break
				case 'accepted':
					console.log('Sombody accepted');
					matching_client.emit('accepted', tmp_guid, data_received);
					break;
				case 'back_into_queue':
					console.log('Somebody is trying to get back into queue');
					matching_client.emit('back_into_queue', tmp_guid, data_received);
					break;
				case 'uuid_received':
					tmp_guid = data_received['content'];
					connection_made(tmp_guid, socket);
					break;
				case 'flag_user':
					clients[data_received['content']]['user_flagged'] = (parseInt(clients[data_received['content']]['user_flagged'])+1).toString();
					clients[data_received['content']]['socket'].write(JSON.stringify({'type': 'you_have_been_flagged'}));
					if(parseInt(clients[data_received['content']]['user_flagged']) == 2){
						// socket.write(JSON.stringify({'type' : 'partner_disconnected', 'content' : 'Nothing'}));
						matching_client.emit('client_disconnected', data_received['content']);
					} else {
						matching_client.emit('back_into_queue', tmp_guid, data_received);
					}
					break;
			} // end of switch
		}
	});
}).listen(8124);

matching_client.on('data', (data) => {
	let data_received = JSON.parse(data);
	let data_to_send = {};
	if( data_received.hasOwnProperty('type') ){
		let data_type = data_received['type'];
		if( data_received.hasOwnProperty('content') ){
			let data_content = data_received['content'];
			if( data_received.hasOwnProperty('id') ){
				let data_id = data_received['id'];
				switch(data_type) {
					case 'matched_with':
						console.log('I got somebody that I matched with');
						// From python: msg_first = {'type':'matched', 'content' : matched_with.name, 'token': redis_server.hget(current_client.name, 'token'), 'send_to' : current_client.name, 'role' : 'send_invite'};
						data_to_send = {'type' : 'matched', 'content' : data_content, 'role' : 'send_invite'}
						clients[data_id]['socket'].write(JSON.stringify(data_to_send));
						break;
					case 'both_people_accepted':
						data_to_send = {'type' : 'continue_conversation', 'content' : 'Nothing'};
						clients[data_id]['socket'].write(JSON.stringify(data_to_send));
						data_to_send = {'type' : 'continue_conversation', 'content' : 'Nothing'};
						clients[data_content]['socket'].write(JSON.stringify(data_to_send));
						break;
					case 'partner_disconnected':
						data_to_send = {'type' : 'partner_disconnected', 'content' : 'Nothing'};
						console.log(data_to_send);
						clients[data_id]['socket'].write(JSON.stringify(data_to_send));
						break;
					case 'ready_to_match':
						data_to_send = {'type' : 'ready_to_match'};
						clients[data_id]['socket'].write(JSON.stringify(data_to_send));
						break;
					default:
						console.log('type not identified');
						console.log(data_type);
				} // end of switch
			} else {
				console.log('no id');
			}// end id
		} else {
			console.log(' no content');
		}// end content
	} else {
		console.log('no type');
	}// end type
});

matching_client.on('end', () => {
	console.log('disconnected from server');
});
matching_client.on('try_to_match', (tmp_guid, data_received) => {
	let data_to_send = {'type':'try_to_match', 'content': data_received, 'id': tmp_guid};
	matching_client.write(JSON.stringify(data_to_send));
});

matching_client.on('join', (tmp_guid, data_received) => {
	let data_to_send =  {'type':'join', 'content': data_received, 'id': tmp_guid};
	matching_client.write(JSON.stringify(data_to_send));
});

matching_client.on('accepted', (tmp_guid, data_received) => {
	let data_to_send =  {'type':'accepted', 'content': data_received, 'id': tmp_guid};
	matching_client.write(JSON.stringify(data_to_send));
});

matching_client.on('back_into_queue', (tmp_guid, data_received) => {
	let data_to_send =  {'type':'back_into_queue', 'content': data_received, 'id': tmp_guid};
	matching_client.write(JSON.stringify(data_to_send));
});

matching_client.on('client_disconnected', (tmp_guid) => {
	console.log('wtf bro');
	let data_to_send =  {'type':'client_disconnected', 'content': '', 'id': tmp_guid};
	matching_client.write(JSON.stringify(data_to_send));
});