from client_model import Client
# For data storage in async.
import redis
from client_model import json
import time
import sys
import os


import socket
import sys

# Create a TCP/IP socket
sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)

# Connect the socket to the port where the server is listening
server_address = ('127.0.0.1', 8123)
print >>sys.stderr, 'connecting to %s port %s' % server_address
sock.connect(server_address)

sock.sendall(json.dumps({"type": "uuid_received", "content": "MASTER_PYTHON"}))


# The maximum distance that two people are allowed to match.
# right now it works as a global variable but in the future each user may be able to set it.
MAXIMUM_DISTANCE = None # in Miles

# Connection to tedis
redis_server = redis.StrictRedis(host='127.0.0.1', port=6379, db=0)

# List of references to all clients: Instances of ClientCommuncation

clients = []

def execute_message(message):
	"""
		Interprets the messages and decides what to do depending on the type
	"""
	print message
	if ('type' in message) and ('id' in message):
		# According to the funnel.js class, there are five types of messages
		# this could receive.
		# 'try_to_match'
		# 'accepted'
		# 'send_both_back_into_matching'
		# 'flag_other_user'
		#
		# First of all I need to check if the client is tyring to joing for the first time.
		if message['type'] == 'try_to_match':
			join = True
			for client in clients:
				if message['id'] == client.id:
					join = False
			if join:
				clients.append(Client(lat_t = message['latitude'], long_t = message['longitude'], id_t = message['id']))
		# If I reach this level I could be assured that the client already joined and therefore
		# base client will never be none.
		base_client = None
		for client in clients:
			if message['id'] == client.id:
				base_client = client
				break
		if message['id'].replace(' ','') == 'MASTER_PYTHON':
			return False
		if not base_client:
			return False
		if message['type'] == 'try_to_match':
			if not base_client.matched_with:
				base_client.try_to_match(clients, sock)
			else:
				print 'I am trying to match but I already matched with: '+base_client.matched_with.id
		elif message['type'] == 'accepted':
			base_client.accepted_f(sock)
		elif message['type'] == 'send_both_back_into_matching':
			base_client.send_both_back_into_matching()
			# Now I automatically send everyone back into matching. because the previous function resets both this guy and the other guy lol
			base_client.try_to_match(clients, sock)
		elif message['type'] == 'flag_other_user':
			base_client.flag_other_user(sock)
			base_client.try_to_match(clients, sock)
		elif message['type'] == 'disconnected':
			base_client.disconnect_completely()
	else:
		print 'WTF'

if __name__=="__main__":
	print "RUNNING IN AN INFINITE LOOP"
	while True:
		message = redis_server.rpop("messages")
		if message:
			execute_message(json.loads(message))
		time.sleep(0.02)
