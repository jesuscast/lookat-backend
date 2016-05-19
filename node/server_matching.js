// Requirements.
const net = require("net");
var Redis = require('ioredis');
var redis_client = new Redis();

// Return blocking style. 
// Return blocking style.
redis_client.multi().hset(data_id,'lat',data_lat).hset(data_id,'long',data_long).hset(data_id,'name', data_id).hset(data_id,'joined', 'true').get('a','b').exec(function (err, results) {
  // results === [[null, 'OK'], [null, 'bar']]
  console.log(results);
});
// Specific functions.
var join_client = (data_type, data_content, data_id) => {
	if( data_content.hasOwnProperty('lat') ){
		var data_lat = data_received['lat'];
		if( data_content.hasOwnProperty('long') ){
			var data_long = data_received['long'];
		} // end of checking for long
	} // end of checking for lat
	return true;
};

var match_client = (data_type, data_content, data_id) => {
	return 1;
};

var back_into_queue = (data_type, data_content, data_id) => {
	return 1;
};

var server = net.createServer((socket) => {
	// This happens whenever it connects for the first time.
	console.log('I have received a connection on the secret port.');

	// Whenever somebody disconnects
	// Remove the client from the list when it leaves
	socket.on('end', () => {
		//broadcast(socket.name + " left the chat.\n");
	});

	socket.on('data', (data) => {
		console.log('Received data');
		var data_received = JSON.parse(data.toString().replace('\n',''));
		console.log(data_received);
		// Loop over the types in order to find the correct response
		// I check first that the response has the three most important fields. type, content, and id.
		if( data_received.hasOwnProperty('type') ){
			var data_type = data_received['type'];
			if( data_received.hasOwnProperty('content') ){
				var data_content = data_received['content'];
				if( data_received.hasOwnProperty('id') ){
					var data_id = data_received['id'];
					switch(data_type) {
						case 'join':
							join_client(data_type, data_content, data_id);
							break;
						case 'try_to_match':
							match_client(data_type, data_content, data_id);
							break;
						case 'accepted':
							client_accepted(data_type, data_content, data_id);
							break;
						case 'back_into_queue':
							back_into_queue(data_type, data_content, data_id);
							break;
					} // end of switch
				} // end of id checker
			} // end of content checkeer
		} // end of type checker
	}); // end of receive data checker.
}).listen(8125);