// Requirements.
const net = require("net");
let Redis = require('ioredis');
let redis_client = new Redis();

// Distance calculator
let distance_calculator = (lat1, lon1, lat2, lon2) => {
	let p = 0.017453292519943295;    // Math.PI / 180
	let c = Math.cos;
	let a = 0.5 - c((lat2 - lat1) * p)/2 + 
	  c(lat1 * p) * c(lat2 * p) * 
	  (1 - c((lon2 - lon1) * p))/2;

	return 12742 * Math.asin(Math.sqrt(a)); // 2 * R; R = 6371 km
};

let array_to_obj = (result) => {
  if (Array.isArray(result)) {
    var obj = {};
    for (var i = 0; i < result.length; i += 2) {
      obj[result[i]] = result[i + 1];
    }
    return obj;
  }
  return result;
};
// Specific functions.
let join_client = (data_type, data_content, data_id) => {
	if( data_content.hasOwnProperty('lat') ){
		let data_lat = data_content['lat'];
		if( data_content.hasOwnProperty('long') ){
			let data_long = data_content['long'];
			redis_client.multi()
				.hset(data_id,'lat',data_lat)
				.hset(data_id,'long',data_long)
				.hset(data_id,'name', data_id)
				.hset(data_id, 'matched_with', 'None')
				.hset(data_id, 'accepted', 'False')
				.hset(data_id,'joined', 'true')
				.hset('clients', data_id, data_id)
				.hset('not_matched', data_id, data_id)
				.exec(function (err, results) {
			  // results === [[null, 'OK'], [null, 'bar']]
			  		console.log(results);
			});
		} else {
			console.log('There is no long.');
		}// end of checking for long
	} else {
		console.log('There is no lat.');
	}// end of checking for lat
	return true;
};

let match_client = (data_type, data_content, data_id, socket) => {
	let result_matching = -1;
	redis_client.multi()
		.hgetall('not_matched').hget(data_id, 'lat').hget(data_id, 'long').exec(function (err, results) {
			// Obtain information from redis.
			let not_matched = array_to_obj(results[0][1]);
			let current_lat = parseInt(results[1][1]);
			let current_long = parseInt(results[2][1]);
			let not_matched_ids = [];
			let tmp_keys = Object.keys(not_matched);
			for(let i = 0; i != tmp_keys.length; i++) {
				if(tmp_keys[i] != data_id) {
					not_matched_ids.push(tmp_keys[i]);
				}
			}
			let current_index = not_matched_ids.indexOf(data_id);
			// Prepare to obtain all lats and longs.
			let commands_for_multi = [];
			for(let index in not_matched_ids) {
				commands_for_multi.push(['hget', not_matched_ids[index], 'lat']);
				commands_for_multi.push(['hget', not_matched_ids[index], 'long']);
			}
			// Calculate all distances.
			redis_client.multi(commands_for_multi).exec(function (err_inner, results_inner) {
				let distances = [];
				for(let i = 0; i < results_inner.length; i += 2) {
					let lat_tmp = parseInt(results_inner[i][1]);
					let long_tmp = parseInt(results_inner[i+1][1]);
					let dist_tmp = distance_calculator(current_lat, current_long, lat_tmp, long_tmp);
					if(Number.isNaN(dist_tmp)) {
						distances.push(0.0);
					} else {
						distances.push(dist_tmp);
					}
				}
				console.log(distances);
				let min_dist = distances[0];
				for(let i = 0; i < distances.length; i++){
					min_dist = Math.min(min_dist, distances[i]);
				}
				console.log(min_dist);
				let lucky_matched = 0;
				if(Number.isNaN(min_dist)) {
					if(current_index == 0 && distances.length > 0) {
						lucky_matched = 1;
					} else if(distances.length == 0) {
						lucky_matched = -1;
					} else {
						lucky_matched = 0;
					}
				} else if(distances.length == 0){
					lucky_matched = -1;
				} else {
					lucky_matched = distances.indexOf(min_dist);
				}
				if(lucky_matched != -1) {
					console.log(lucky_matched);
					lucky_matched = lucky_matched;
					console.log(not_matched_ids);
					console.log('Matched with: '+not_matched_ids[lucky_matched]);
					result_matching = not_matched_ids[lucky_matched];
				} else {
					result_matching = -1;
				}
				if(result_matching != -1) {
					redis_client.multi()
						.hdel('not_matched', data_id)
						.hdel('not_matched', result_matching)
						.hset('matched', data_id, data_id)
						.hset('matched', result_matching, result_matching)
						.hset(data_id, 'matched_with', result_matching)
						.hset(result_matching, 'matched_with', data_id)
						.exec(function (err, results) {
							let data_to_send = {'content' : result_matching, 'type' : 'matched_with', 'id' : data_id};
							socket.write(JSON.stringify(data_to_send));
					});
				}
			});
	});
};

let back_into_queue = (data_type, data_content, data_id, socket) => {
	redis_client.multi()
		.hset(data_id, 'matched_with', 'None')
		.hset(data_id, 'accepted', 'False')
		.hset('clients', data_id, data_id)
		.hset('not_matched', data_id, data_id)
		.hdel('matched', data_id)
		.exec(function (err, results) {
			let data_to_send = {'content' : data_id, 'type' : 'ready_to_match', 'id' : data_id};
			socket.write(JSON.stringify(data_to_send));
		});
};

let client_accepted = (data_type, data_content, data_id, socket) => {
	redis_client.multi()
		.hset(data_id, 'accepted', 'True')
		.hget(data_id, 'matched_with')
		.exec(function (err, results) {
			console.log(results[1][1]);
			redis_client.multi()
				.hget(results[1][1], 'accepted')
				.exec(function (err_inner, results_inner) {
					console.log(results_inner[0][1]);
					if(results_inner[0][1] == 'True') {
						console.log('Both people accepted');
						let data_to_send = {'content' : results[1][1], 'type' : 'both_people_accepted', 'id' : data_id};
						socket.write(JSON.stringify(data_to_send));
					}
				});
		});
	return 1;
};

let client_disconnected = (data_type, data_content, data_id, socket) => {
	redis_client.multi()
		.hget(data_id, 'matched_with')
		.hdel(data_id,'lat')
		.hdel(data_id,'long')
		.hdel(data_id,'name')
		.hdel(data_id, 'matched_with')
		.hdel(data_id, 'accepted')
		.hdel(data_id,'joined')
		.hdel('clients', data_id)
		.hdel('not_matched', data_id)
		.hdel('matched', data_id)
		.exec(function (err, results) {
			if(results[0][1] != 'None'){
				console.log('kill me: '+results[0][1]);
				redis_client.multi()
					.hset(results[0][1], 'matched_with' ,'None')
					.hset(results[0][1], 'accepted' ,'False')
					.hdel('matched', results[0][1])
					.hset('not_matched', results[0][1], results[0][1])
					.exec(function (err_inner, results_inner) {
						console.log('Reset the previous guy as well. Now time to message the other guy.');
						let data_to_send = {'content' : results[0][1], 'type' : 'partner_disconnected', 'id' : results[0][1]};
						socket.write(JSON.stringify(data_to_send));
					});
			}
		});
};

let server = net.createServer((socket) => {
	// This happens whenever it connects for the first time.
	console.log('I have received a connection on the secret port.');

	// Whenever somebody disconnects
	// Remove the client from the list when it leaves
	socket.on('end', () => {
		//broadcast(socket.name + " left the chat.\n");
	});

	socket.on('data', (data) => {
		console.log('Received data');
		let data_received = JSON.parse(data.toString().replace('\n',''));
		console.log(data_received);
		// Loop over the types in order to find the correct response
		// I check first that the response has the three most important fields. type, content, and id.
		if( data_received.hasOwnProperty('type') ){
			let data_type = data_received['type'];
			if( data_received.hasOwnProperty('content') ){
				let data_content = data_received['content'];
				if( data_received.hasOwnProperty('id') ){
					let data_id = data_received['id'];
					switch(data_type) {
						case 'join':
							console.log('joining?');
							join_client(data_type, data_content, data_id);
							break;
						case 'try_to_match':
							console.log('Hello I am the client matching');
							let result = match_client(data_type, data_content, data_id, socket);
							break;
						case 'accepted':
							console.log('accepted?');
							client_accepted(data_type, data_content, data_id, socket);
							break;
						case 'back_into_queue':
							console.log('Back into queue?');
							back_into_queue(data_type, data_content, data_id, socket);
							break;
						case 'client_disconnected':
							console.log('Client disconnected');
							client_disconnected(data_type, data_content, data_id, socket);
							break;
						default:
							console.log('data type not defined');
							console.log(data_type);
					} // end of switch
				} else {
					console.log('Does not have id');
				}// end of id checker
			} else {
				console.log(' does no have content');
			}// end of content checkeer
		} else {
			console.log('Does not have type');
		}// end of type checker
	}); // end of receive data checker.
}).listen(8125);