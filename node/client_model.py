# Geolocation Libraries
from geopy.distance import vincenty
# System Utilities
import json


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
		self.connected = True
		self.accepted = False
		self.ready_to_match = False
		self.flags_number = 0
	def distance_from(self, lat_2, long_2):
		"""
			Calculates the distance from the client to coordinates
		"""
		return vincenty((self.lat, self.long), (lat_2, long_2)).miles
	def disconnect(self):
		"""
			Set values as if it has not matched with anybody
		"""
		self.matched_with = None
		self.accepted = False
		self.ready_to_match = False
		return True
	def flag_myself(self):
		self.disconnect()
		self.flags_number += 1
		return True
	def disconnect_completely(self):
		"""
			Sets itself as disconnected a.k.a not talking etc, and sets the matching parnter to empty
		"""
		if self.matched_with:
			print 'I had something I matched with previously'
			self.matched_with.disconnect()
		self.disconnect()
		self.connected = False
		return True
	def flag_other_user(self, sock):
		"""
			Flags the other user
		"""
		if self.matched_with and self.matched_with.connected and self.connected:
			matched_with_id = self.matched_with.id
			self.matched_with.flag_myself()
			self.disconnect()
			sock.sendall(json.dumps({'type': 'send_both_back_into_matching', 'person_a': self.id, 'person_b': matched_with_id}))
		else:
			print 'Base client was not matched with anybody or one or the other was not connected'
		return True
	def try_to_match(self, clients, sock):
		"""
			Tries to match the current client
		"""
		self.ready_to_match = True
		distances_and_ids = []
		if self.flags_number > 2:
			sock.sendall({'type': 'connection_not_accepted', 'content': self.id})
			return True
		for index, client in enumerate(clients):
			if (client.id == self.id) or (client.matched_with != None) or (not client.connected) or (not client.ready_to_match):
				continue
			distances_and_ids.append((client.distance_from( self.lat, self.long ), index))
		distances_and_ids = sorted(distances_and_ids, key=lambda distance: distance[0])
		if len(distances_and_ids) > 0:
			matched_with = clients[distances_and_ids[0][1]]
			matched_with.matched_with = self
			self.matched_with = matched_with
			print 'matched_with: '+str(matched_with.id)
			sock.sendall(json.dumps({'type':'matched_with', 'person_a': self.id, 'person_b': self.matched_with.id}))
		else:
			print 'Did not match with anybody'
		return True
	def accepted(self, sock):
		"""
			Sets values for this client to accept the conversation.
			If the other client accepted too then send a socket request
		"""
		if self.matched_with and self.matched_with.connected and self.connected:
			if self.matched_with.matched_with == self:
				print 'Everything seems correct'
				self.accepted = True
				if self.matched_with.accepted:
					print 'Oh wow the other person accepted as well'
					print 'Both accepted'
					sock.sendall(json.dumps({'type':'both_accepted', 'person_a': self.id, 'person_b': self.matched_with.id}))
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
