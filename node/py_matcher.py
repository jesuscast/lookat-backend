# Geolocation Libraries
from geopy.distance import vincenty
# For data storage in async.
import redis
# System Utilities
import json
import time
import sys
import os


import socket
import sys

# Create a TCP/IP socket
sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)

# Connect the socket to the port where the server is listening
server_address = ('127.0.0.1', 8124)
print >>sys.stderr, 'connecting to %s port %s' % server_address
sock.connect(server_address)

sock.sendall(json.dumps({"type": "uuid_received", "content": " MASTER_PYTHON"}))


# The maximum distance that two people are allowed to match.
# right now it works as a global variable but in the future each user may be able to set it.
MAXIMUM_DISTANCE = None # in Miles

# Connection to tedis
redis_server = redis.StrictRedis(host='127.0.0.1', port=6379, db=0)

# List of references to all clients: Instances of ClientCommuncation

class Client:
	def __init__(self, lat_t = 0.0, long_t = 0.0, id_t= ''):
		self.lat = lat_t
		self.long = long_t
		self.id = id_t
		self.matched_with = None
		self.connected = True
		self.accepted = True
		self.flags_number = 0
		self.state = 'connected'
	def distance_from(self, lat_2, long_2):
		return vincenty((self.lat, self.long), (lat_2, long_2)).miles
	def disconnect_partner(self):
		self.matched_with = None
		self.accepted = False
	def disconnect(self):
		self.matched_with = None
		self.accepted = False
		self.connected = False

clients = []

def execute_message(message):
	if 'type' in message:
		if message['type'] == 'join':
			join = True
			for client in clients:
				if message['id'] == client.id:
					join = False
			if join:
				clients.append(Client(lat_t = message['lat'], long_t = message['long'], id_t = message['id']))
			print len(clients)
		elif message['type'] == 'try_to_match':
			distances_and_ids = []
			base_client = None
			for client in clients:
				if message['id'] == client.id:
					base_client = client
			if base_client.flags_number > 2:
				sock.sendall({'type': 'connection_not_accepted', 'content': base_client.id})
			if base_client:
				for index, client in enumerate(clients):
					if client.id == message['id']:
						continue
					if client.matched_with:
						continue
					if not client.connected:
						continue
					distances_and_ids.append((client.distance_from( base_client.lat, base_client.long ), index))
			else:
				print 'Could not find a client with this id.'
				return False
			distances_and_ids = sorted(distances_and_ids, key=lambda distance: distance[0])
			if len(distances_and_ids) > 0:
				matched_with = clients[distances_and_ids[0][1]]
				matched_with.matched_with = base_client
				base_client.matched_with = matched_with
				print 'matched_with: '+str(matched_with.id)
				sock.sendall(json.dumps({'type':'matched_with', 'person_a': base_client.id, 'person_b': base_client.matched_with.id}))
			else:
				print 'Did not match with anybody'
		elif message['type'] == 'accepted':
			base_client = None
			for client in clients:
				if message['id'] == client.id:
					base_client = client
			if base_client.matched_with and base_client.matched_with.connected and base_client.connected:
				if base_client.matched_with.matched_with == base_client:
					print 'Everything seems correct'
					base_client.accepted = True
					if base_client.matched_with.accepted:
						print 'Oh wow the other person accepted as well'
						print 'Both accepted'
						sock.sendall(json.dumps({'type':'both_accepted', 'person_a': base_client.id, 'person_b': base_client.matched_with.id}))
					print 'accepted: '+base_client.id
				else:
					print 'This does not seem correct. Matched with is not matched with base client.'
			else:
				print 'Base client was not matched with anybody or one or the other was not connected'
		elif message['type'] == 'disconnected':
			base_client = None
			for client in clients:
				if message['id'] == client.id:
					base_client = client
			# So because tiwlio alreayd takes care of informing the other client that the first one has disconnected.
			# I could just put the matched guy back into the queue
			if base_client:
				if base_client.matched_with:
					print 'I had something I matched with previously'
					base_client.matched_with.matched_with = None
					base_client.matched_with.accepted = False
				base_client.disconnect()
				print 'Correctly eliminated '+base_client.id+' from existance'
			else:
				print 'Did not found anybody with this name'
		elif message['type'] == 'flag_other_user':
			base_client = None
			for client in clients:
				if message['id'] == client.id:
					base_client = client
			if base_client:
				if base_client.matched_with and base_client.matched_with.connected and base_client.connected:
					matched_with_id = base_client.matched_with.id
					base_client.matched_with.flags_number += 1
					base_client.matched_with.matched_with = None
					base_client.matched_with.accepted = False
					base_client.matched_with = None
					base_client.accepted = False
					sock.sendall(json.dumps({'type': 'send_both_back_into_matching', 'person_a': base_client.id, 'person_b': matched_with_id}))
				else:
					print 'Base client was not matched with anybody or one or the other was not connected'
			else:
				print 'Base client not found'

while True:
	message = redis_server.rpop("messages")
	if message:
		execute_message(json.loads(message))
	time.sleep(0.02)
