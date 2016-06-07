# For data storage in async.
import redis
import json


debug = False
class RedisInterface:
	"""
		Provides access to common functions related to the management of clients.
	"""
	def __init__(self, host = '127.0.0.1', port = 6379, db = 0):
		self.redis_server = redis.StrictRedis(host, port, db)
	def setK(self, client_name, key, value):
		""" Sets a specific key for a particular client """
		client_current_data = {}
		try:
			client_current_data = json.loads(self.redis_server.hget('clients', client_name))
		except:
			client_current_data = {}
		client_current_data[key] = value
		self.redis_server.hset('clients', client_name, json.dumps(client_current_data))
		return True
	def getK(self, client_name, key):
		""" Returns a particular key for a particular client """
		client_current_data = json.loads(self.redis_server.hget('clients', client_name))
		return client_current_data[key]
	def setM(self, client_name, data):
		""" Sets multiple keys for the client """
		client_current_data = json.loads(self.redis_server.hget('clients', client_name))
		for key, value in data:
			client_current_data[key] = value
		self.redis_server.hset('clients', client_name, json.dumps(client_current_data))
	def disconnect(self, client_name):
		self.setM(client_name, [('matched_with','none'),('accepted','false'),('ready_to_match','false')])
	def flag(self, client_name):
		self.disconnect_client(client_name)
		self.setK(client_name, 'flags_number', int(self.getK(client_name, 'flags_number'))+1)
	def disconnect_completely(self, client_name):
		self.disconnect(client_name)
		self.setK(client_name, 'connected', 'false')
	def ready_to_match(self, client_name):
		self.setK(client_name, 'ready_to_match', 'true')
	def accepted(self, client_name):
		self.setK(client_name, 'accepted', 'true')
	def matched(self, client_name, matched_with):
		self.setK(client_name, 'matched_with', matched_with)
		self.setK(matched_with, 'matched_with', client_name)