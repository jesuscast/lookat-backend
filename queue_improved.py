# Twilio Libraries in order to deal with sessions
from twilio.access_token import AccessToken, ConversationsGrant
# Twisted Libraries
from twisted.internet.protocol import Factory, Protocol
from twisted.internet import reactor
# In order to obtain random names for Twilio.
from faker import Factory as FakerFactory
# Geolocation Libraries
from geopy.distance import vincenty
# For data storage in async.
import redis
# System Utilities
import json
import sys
import os

# The maximum distance that two people are allowed to match.
# right now it works as a global variable but in the future each user may be able to set it.
MAXIMUM_DISTANCE = None # in Miles

# Connection to tedis
redis_server = redis.StrictRedis(host='127.0.0.1', port=6379, db=0)

# Twilio Credentials.
account_sid = "AC5e8ed5029d7539d496c3e8fd538e10fd"
api_key = "SK9c30753a41ccb5a9f21be736384866db"
api_secret = "WyuKvPxehyA5YzFRDTm3X2PsRjq2LC92"
configuration_profile_sid = "VS4b07a03bb48f5d33c988e466f9be30bb"

# List of references to all clients: Instances of ClientCommuncation
clients = []


# Print with flush. Done in order to solve issues when the values are logged into a file.
# and I want to track the file with `tail -f`
def printc(message):
	""" Prints and then `cleans` (flushes) """
	print message
	sys.stdout.flush()

def obtain_client_distances(current_client):
	""" 
		Returns a tuple with the distances of all clients in the not_matched list from the current_client
		Args:
			current_client <ClientCommuncation>: All of the distances are from this point.
		Returns:
			(
				Array<Float>:	An array of all the distances,
				Array<Object Reference>: An array of the correspondent object references to the clients. Matching the order of the returned distances.
			)
	"""
	self_coordinates = ( float(redis_server.hget(current_client.name, 'lat')), float(redis_server.hget(current_client.name, 'long')) )
	distances = []
	respective_clients = []
	not_matched_set = redis_server.hkeys('not_matched')
	for client in clients:
		if client == current_client:
			continue
		if redis_server.hget(client.name, 'joined') == 'False':
			continue
		if client.name not in not_matched_set:
			continue
		client_coordinates = ( float(redis_server.hget(client.name, 'lat')), float(redis_server.hget(client.name, 'long')) )
		distances.append(vincenty(self_coordinates, client_coordinates).miles)
		respective_clients.append(client)
	return distances, respective_clients

def update_matched_clients_data(current_client, matched_with):
	""" When two clients match. Updates the data of both of them. It also informs the last client that tried to match """
	printc('I was successful on matching this person.')
	printc('   Mine -> Name: '+str(current_client.name))
	printc('   His  -> Name: '+str(matched_with.name))
	if redis_server.hexists('not_matched', current_client.name):
		redis_server.hdel('not_matched', current_client.name)
	if redis_server.hexists('not_matched', matched_with.name):
		redis_server.hdel('not_matched', matched_with.name)
	redis_server.hset('matched', current_client.name, current_client.name)
	redis_server.hset('matched', matched_with.name, current_client.name)
	redis_server.hset(current_client.name, 'matched_with', matched_with.name)
	redis_server.hset(matched_with.name, 'matched_with', current_client.name)
	msg_first = {'type':'matched', 'content' : matched_with.name, 'token': redis_server.hget(current_client.name, 'token'), 'send_to' : current_client.name, 'role' : 'send_invite'}
	msgs = [ msg_first ]
	current_client.send_messages(msgs)

def matching_dispatcher(current_client):
	"""
		Tries to match the current client. If it is not able to match then it doesn't return anything.
		If it matches with somebody then updates the data of itself and the matching client in redis and informs the current_client. There is no need to inform the matching client because it will know once the current_client tries to stablish a video connection through twilio.
		Args:
			current_client <ClientCommuncation>: The reference to the current client.
		Returns:
			Nothing but it sends a message to the current_client if it matches (through its method send_messages)
	"""
	printc('Trying to match '+str(current_client.name))
	distances, respective_clients = obtain_client_distances(current_client)
	minimum_distance = 0
	matched_with = None
	if len(distances) != 0:
			minimum_distance = min(distances)
			printc('minimum_distance: '+str(minimum_distance))
			if MAXIMUM_DISTANCE:
				if minimum_distance < MAXIMUM_DISTANCE:
					matched_with = respective_clients[ distances.index(minimum_distance) ]
				else:
					printc("Less than minimum distance")
			else:
				matched_with = respective_clients[ distances.index(minimum_distance) ]
	else:
		printc("Simply didn't match with anybody")
	if matched_with:
		update_matched_clients_data(current_client, matched_with)

class ClientCommuncation(Protocol):
	""" Handles all of the communications with a client """
	def connectionMade(self):
		""" Executed the first time a connection is made. I immediately return a token so the client can start making a video connection. """
		printc("Somebody just connected")
		identity, token = self.obtain_token_data()
		self.token = token
		self.identity = identity
		print self.identity
		msg = {'type':'connection_received', 'token': token, 'identity' : identity}
		self.message(json.dumps(msg))
	def matching(self):
		""" The act of matching itself, I put the actual code outside of the class in order to make it cleaner.
			Also because I was trying to make it async but I couldn't """
		matching_dispatcher(self)
	def connectionLost(self, reason):
		""" Called when a client's conenction is lost. It deletes the client's data from redis, and if it was in a conversation it sets the data of the other client as not_matched so it could connect with somebody else """ 
		printc('Connection lost for a client')
		for key in ['clients', 'not_matched', 'matched']:
			if redis_server.hexists(key, self.name):
				redis_server.hdel(key, self.name)
		del clients[ clients.index(self) ]
		possible_match = redis_server.hget(self.name, 'matched_with')
		redis_server.delete(self.name)
		# If there was a conversation going on, send a message to the other partner.
		print 'possible_match: '+possible_match
		if possible_match != 'None':
			if redis_server.hexists('matched', possible_match):
				printc('Was matched with somebody')
				redis_server.hdel('matched', possible_match)
				redis_server.hset('not_matched', possible_match, possible_match)
				msgs = [ { 'type' : 'partner_disconnected', 'send_to' : possible_match, 'token': '', 'content': 'Nothing'} ]
				for client in clients:
					if client.name == possible_match:
						client.send_messages(msgs)
			else:
				printc('Was matched with nobody')
	def initialize_data(self, data_j):
		""" After a client joins, this is the next step. Sets up basic variables of the client into redis, in order to keep track of it """
		msgs = []
		self.name = self.identity #data_j['name']
		for key in ['lat', 'long']:
			redis_server.hset(self.name, key, data_j[key])
		clients.append(self)
		# Set values in its own hashm on redis
		redis_server.hset(self.name, 'name', self.name)
		redis_server.hset(self.name, 'identity', self.identity)
		redis_server.hset(self.name, 'token', self.token)
		redis_server.hset(self.name, 'joined', 'True')
		# Now set values in the lists of clients.
		redis_server.hset('clients', self.name, self.name)
		redis_server.hset('not_matched', self.name, self.name)
		redis_server.hset(self.name, 'matched_with', 'None')
		redis_server.hset(self.name, 'accepted', 'False')
	def obtain_token_data(self):
		""" Obtains token for the video calls """
		# Create an Access Token
		token = AccessToken(account_sid, api_key, api_secret)
		# Set the Identity of this token
		fake = FakerFactory.create()
		token.identity = fake.user_name()
		# Grant access to Conversations
		grant = ConversationsGrant()
		grant.configuration_profile_sid = configuration_profile_sid
		token.add_grant(grant)
		return token.identity, token.to_jwt()
	def dataReceived(self, data):
		""" Receives some data from the client's side """
		data_j = json.loads(data)
		msgs = []
		if data_j['type'] == 'join':
			printc('Joining')
			self.initialize_data(data_j)
		elif data_j['type'] == 'try_to_match':
			self.matching()
		elif data_j['type'] == 'accepted':
			redis_server.hset(self.name, 'accepted', 'True')
			matched_with_name = redis_server.hget(self.name, 'matched_with')
			if redis_server.hget( matched_with_name , 'accepted') ==  'True':
				msgs = [ { 'type' : 'continue_conversation', 'send_to' : self.name , 'token': redis_server.hget(self.name, 'token'), 'content': 'Nothing'}, { 'type' : 'continue_conversation', 'send_to' : matched_with_name , 'token': redis_server.hget(matched_with_name, 'token'), 'content': 'Nothing'} ]
		elif data_j['type'] == 'back_into_queue':
			if redis_server.hexists('matched', self.name):
				redis_server.hdel('matched', self.name, self.name)
			redis_server.hset('not_matched', self.name, self.name)
			redis_server.hset(self.name, 'accepted', 'False')
			redis_server.hset(self.name, 'matched_with', 'None')
			msgs += [ { 'type' : 'ready_to_match', 'send_to' : self.name , 'token': redis_server.hget(self.name, 'token'), 'content': 'Nothing'} ]
		self.send_messages(msgs)
	def send_messages(self, msgs):
		""" Sends a list of messages. Every message is a dictionary and must contain the key 'send_to' which must equal to the name of the client it is directed to """
		for msg in msgs:
			for client in clients:
				try:
					if client.name == msg['send_to']:
						client.message(json.dumps(msg))
				except Exception as e:
					printc('Wow what just happened')
					printc(str(e))
	def message(self, message):
		""" function that writes to the socket in order to send data back to the client """
		self.transport.write(message+'\n')

if __name__=="__main__":
	# Create the entry point.
	factory_tmp = Factory()
	# Set redis global variables.
	redis_server.hset('clients','always_present','always_present')
	redis_server.hset('not_matched','always_present','always_present')
	redis_server.hset('matched','always_present','always_present')
	# Final steps
	factory_tmp.protocol = ClientCommuncation
	reactor.listenTCP(8123, factory_tmp)
	printc('Server began already.')
	reactor.run()
