'use strict';

// Requirements.
var net = require("net");
var Redis = require('ioredis');
var redis_client = new Redis();

// Distance calculator
var distance_calculator = function distance_calculator(lat1, lon1, lat2, lon2) {
	var p = 0.017453292519943295; // Math.PI / 180
	var c = Math.cos;
	var a = 0.5 - c((lat2 - lat1) * p) / 2 + c(lat1 * p) * c(lat2 * p) * (1 - c((lon2 - lon1) * p)) / 2;

	return 12742 * Math.asin(Math.sqrt(a)); // 2 * R; R = 6371 km
};

var array_to_obj = function array_to_obj(result) {
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
var join_client = function join_client(data_type, data_content, data_id, socket) {
	if (data_content.hasOwnProperty('lat')) {
		var data_lat = data_content['lat'];
		if (data_content.hasOwnProperty('long')) {
			var data_long = data_content['long'];
			redis_client.multi().hset(data_id, 'lat', data_lat).hset(data_id, 'long', data_long).hset(data_id, 'name', data_id).hset(data_id, 'matched_with', 'None').hset(data_id, 'accepted', 'False').hset(data_id, 'joined', 'true').hset('clients', data_id, data_id).hset('not_matched', data_id, data_id).exec(function (err, results) {
				// results === [[null, 'OK'], [null, 'bar']]
				console.log(results);
				var data_to_send = { 'content': data_id, 'type': 'ready_to_match', 'id': data_id };
				socket.write(JSON.stringify(data_to_send));
			});
		} else {
			console.log('There is no long.');
		} // end of checking for long
	} else {
			console.log('There is no lat.');
		} // end of checking for lat
	return true;
};

var match_client = function match_client(data_type, data_content, data_id, socket) {
	var result_matching = -1;
	redis_client.multi().hgetall('not_matched').hget(data_id, 'lat').hget(data_id, 'long').exec(function (err, results) {
		// Obtain information from redis.
		var not_matched = array_to_obj(results[0][1]);
		var current_lat = parseInt(results[1][1]);
		var current_long = parseInt(results[2][1]);
		var not_matched_ids = [];
		var tmp_keys = Object.keys(not_matched);
		for (var i = 0; i != tmp_keys.length; i++) {
			if (tmp_keys[i] != data_id) {
				not_matched_ids.push(tmp_keys[i]);
			}
		}
		var current_index = not_matched_ids.indexOf(data_id);
		// Prepare to obtain all lats and longs.
		var commands_for_multi = [];
		for (var index in not_matched_ids) {
			commands_for_multi.push(['hget', not_matched_ids[index], 'lat']);
			commands_for_multi.push(['hget', not_matched_ids[index], 'long']);
		}
		// Calculate all distances.
		redis_client.multi(commands_for_multi).exec(function (err_inner, results_inner) {
			var distances = [];
			for (var _i = 0; _i < results_inner.length; _i += 2) {
				var lat_tmp = parseInt(results_inner[_i][1]);
				var long_tmp = parseInt(results_inner[_i + 1][1]);
				var dist_tmp = distance_calculator(current_lat, current_long, lat_tmp, long_tmp);
				if (Number.isNaN(dist_tmp)) {
					distances.push(0.0);
				} else {
					distances.push(dist_tmp);
				}
			}
			console.log(distances);
			var min_dist = distances[0];
			for (var _i2 = 0; _i2 < distances.length; _i2++) {
				min_dist = Math.min(min_dist, distances[_i2]);
			}
			console.log(min_dist);
			var lucky_matched = 0;
			if (Number.isNaN(min_dist)) {
				if (current_index == 0 && distances.length > 0) {
					lucky_matched = 1;
				} else if (distances.length == 0) {
					lucky_matched = -1;
				} else {
					lucky_matched = 0;
				}
			} else if (distances.length == 0) {
				lucky_matched = -1;
			} else {
				lucky_matched = distances.indexOf(min_dist);
			}
			if (lucky_matched != -1) {
				console.log(lucky_matched);
				lucky_matched = lucky_matched;
				console.log(not_matched_ids);
				console.log('Matched with: ' + not_matched_ids[lucky_matched]);
				result_matching = not_matched_ids[lucky_matched];
			} else {
				result_matching = -1;
			}
			if (result_matching != -1) {
				redis_client.multi().hdel('not_matched', data_id).hdel('not_matched', result_matching).hset('matched', data_id, data_id).hset('matched', result_matching, result_matching).hset(data_id, 'matched_with', result_matching).hset(result_matching, 'matched_with', data_id).exec(function (err, results) {
					var data_to_send = { 'content': result_matching, 'type': 'matched_with', 'id': data_id };
					socket.write(JSON.stringify(data_to_send));
				});
			}
		});
	});
};

var back_into_queue = function back_into_queue(data_type, data_content, data_id, socket) {
	redis_client.multi().hset(data_id, 'matched_with', 'None').hset(data_id, 'accepted', 'False').hset('clients', data_id, data_id).hset('not_matched', data_id, data_id).hdel('matched', data_id).exec(function (err, results) {
		var data_to_send = { 'content': data_id, 'type': 'ready_to_match', 'id': data_id };
		socket.write(JSON.stringify(data_to_send));
	});
};

var client_accepted = function client_accepted(data_type, data_content, data_id, socket) {
	redis_client.multi().hset(data_id, 'accepted', 'True').hget(data_id, 'matched_with').exec(function (err, results) {
		console.log(results[1][1]);
		redis_client.multi().hget(results[1][1], 'accepted').exec(function (err_inner, results_inner) {
			console.log(results_inner[0][1]);
			if (results_inner[0][1] == 'True') {
				console.log('Both people accepted');
				var data_to_send = { 'content': results[1][1], 'type': 'both_people_accepted', 'id': data_id };
				socket.write(JSON.stringify(data_to_send));
			}
		});
	});
	return 1;
};

var client_disconnected = function client_disconnected(data_type, data_content, data_id, socket) {
	redis_client.multi().hget(data_id, 'matched_with').hdel(data_id, 'lat').hdel(data_id, 'long').hdel(data_id, 'name').hdel(data_id, 'matched_with').hdel(data_id, 'accepted').hdel(data_id, 'joined').hdel('clients', data_id).hdel('not_matched', data_id).hdel('matched', data_id).exec(function (err, results) {
		if (results[0][1] != 'None') {
			console.log('kill me: ' + results[0][1]);
			redis_client.multi().hset(results[0][1], 'matched_with', 'None').hset(results[0][1], 'accepted', 'False').hdel('matched', results[0][1]).hset('not_matched', results[0][1], results[0][1]).exec(function (err_inner, results_inner) {
				console.log('Reset the previous guy as well. Now time to message the other guy.');
				var data_to_send = { 'content': results[0][1], 'type': 'partner_disconnected', 'id': results[0][1] };
				socket.write(JSON.stringify(data_to_send));
			});
		}
	});
};

var server = net.createServer(function (socket) {
	// This happens whenever it connects for the first time.
	console.log('I have received a connection on the secret port.');

	// Whenever somebody disconnects
	// Remove the client from the list when it leaves
	socket.on('end', function () {
		//broadcast(socket.name + " left the chat.\n");
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
		for (var _i3 = 0; _i3 < array_of_messages.length; _i3++) {
			var data_received = JSON.parse(array_of_messages[_i3].replace('\n', ''));
			// Loop over the types in order to find the correct response
			// I check first that the response has the three most important fields. type, content, and id.
			if (data_received.hasOwnProperty('type')) {
				var data_type = data_received['type'];
				if (data_received.hasOwnProperty('content')) {
					var data_content = data_received['content'];
					if (data_received.hasOwnProperty('id')) {
						var data_id = data_received['id'];
						switch (data_type) {
							case 'join':
								console.log('join from: ' + data_id);
								join_client(data_type, data_content, data_id, socket);
								break;
							case 'try_to_match':
								console.log('try_to_match from: ' + data_id);
								var result = match_client(data_type, data_content, data_id, socket);
								break;
							case 'accepted':
								console.log('accepted from: ' + data_id);
								client_accepted(data_type, data_content, data_id, socket);
								break;
							case 'back_into_queue':
								console.log('back_into_queue from: ' + data_id);
								back_into_queue(data_type, data_content, data_id, socket);
								break;
							case 'client_disconnected':
								console.log('client disconnected: ' + data_id);
								client_disconnected(data_type, data_content, data_id, socket);
								break;
							default:
								console.log('data type not defined: ' + data_id);
								console.log(data_type);
						} // end of switch
					} else {
							console.log('Does not have id');
						} // end of id checker
				} else {
						console.log(' does no have content');
					} // end of content checkeer
			} else {
					console.log('Does not have type');
				} // end of type checker
		}
	}); // end of receive data checker.
}).listen(8125);