# Geolocation Libraries
from geopy.distance import vincenty
# System Utilities
from redis_interface import RedisInterface
import json


redis_interface = RedisInterface()

# I always set values in the following order
# lat
# long
# id
# matched_with
# connected
# accepted
# ready_to_match
# flags_number

# I think it is important to not automatically match clients until they send a message
# requesting to be matched.

class Client:
	def __init__(self, lat_t = 0.0, long_t = 0.0, id_t= ''):
		self.lat = lat_t
		self.long = long_t
		self.id = id_t
		self.matched_with = None
		self.ready_to_match = True
		# Create default values on redis if they do not exist.
		for key, default in [('flags_number','0'), ('matched_with', 'none'), ('ready_to_match', 'true'), ('accepted', 'false')]:
			redis_interface.setK(self.id, key, default)
	def distance_from(self, lat_2, long_2):
		"""
			Calculates the distance from the client to coordinates
		"""
		return vincenty((self.lat, self.long), (lat_2, long_2)).miles
	def disconnect(self):
		"""
			Set values as if it has not matched with anybody.
			Sets ready_to_match = false, matched_with = none, accepted = false
		"""
		redis_interface.disconnect(self.id)
		self.ready_to_match = False
		self.matched_with = None
		self.accepted = False
		return True
	def ready_to_match_f(self):
		self.ready_to_match = True
		redis_interface.ready_to_match(self.id)
	def flag_myself(self):
		redis_interface.flag(self.id)
		return True
	def disconnect_completely(self):
		"""
			Sets itself as disconnected a.k.a not talking etc, and sets the matching parnter to empty
		"""
		matched_with = self.matched_with
		if matched_with:
			matched_with.disconnect()
			matched_with.ready_to_match_f()
		self.disconnect()
		return True
	def flag_other_user(self, sock):
		"""
			Flags the other user
		"""
		if self.matched_with:
			matched_with_id = self.matched_with.id
			self.matched_with.flag_myself()
			self.send_both_back_into_matching()
			sock.sendall(json.dumps({'type': 'person_was_flagged', 'person_a': matched_with_id, 'id':'MASTER_PYTHON'}))
		else:
			print 'Base client was not matched with anybody or one or the other was not connected'
		return True
	def try_to_match(self, clients, sock):
		"""
			Tries to match the current client
		"""
		self.ready_to_match_f()
		distances_and_ids = []
		# First make sure flags exist
		if int(redis_interface.getK(self.id, 'flags_number')) > 2:
			print 'Connection not accepted'
			sock.sendall({'type': 'connection_not_accepted', 'person_a': self.id, 'id':'MASTER_PYTHON'})
			return True
		for index, client in enumerate(clients):
			if (client.id == self.id) or (client.matched_with != None) or (not client.ready_to_match):
				print "I had to continue"
				continue
			if int(redis_interface.getK(client.id, 'flags_number')) > 2:
				print client.id+' has more than two flags therefore he is not allowed to talk'
				continue
			distances_and_ids.append((client.distance_from( self.lat, self.long ), index))
		distances_and_ids = sorted(distances_and_ids, key=lambda distance: distance[0])
		if len(distances_and_ids) > 0:
			matched_with = clients[distances_and_ids[0][1]]
			matched_with.matched_with = self
			self.matched_with = matched_with
			redis_interface.matched(matched_with.id, self.id)
			print 'matched_with: '+str(matched_with.id)
			sock.sendall(json.dumps({'type':'clients_matched', 'person_a': self.id, 'id':'MASTER_PYTHON', 'person_b': self.matched_with.id}))
		else:
			print 'Did not match with anybody'
		return True
	def send_both_back_into_matching(self):
		if not self.matched_with:
			print "I tried to send_both_back_into_matching but I had no matches"
			return False
		matched_with = self.matched_with
		# Set for the matched with guy.
		matched_with.disconnect()
		matched_with.ready_to_match_f()
		# Set up for myself.
		self.disconnect()
		self.ready_to_match_f()
		return True
	def accepted_f(self, sock):
		"""
			Sets values for this client to accept the conversation.
			If the other client accepted too then send a socket request
		"""
		if self.matched_with:
			if self.matched_with.matched_with == self:
				print 'Everything seems correct'
				redis_interface.accepted(self.id)
				if redis_interface.getK(self.matched_with.id, 'accepted'): #self.matched_with.accepted:
					print 'Oh wow the other person accepted as well'
					print 'Both accepted'
					sock.sendall(json.dumps({'type':'both_accepted', 'id':'MASTER_PYTHON', 'person_a': self.id, 'person_b': self.matched_with.id}))
				print 'accepted: '+self.id
			else:
				print 'This does not seem correct. Matched with is not matched with base client.'
		else:
			print 'Base client was not matched with anybody or one or the other was not connected'
		return True


if __name__=="__main__":
	print "it should not be called by itself"
	#
	#
	#
