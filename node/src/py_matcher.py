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

# List of references to all clients: Instances of ClientCommuncation
clients = []

def execute_message(message):
	print message

while True:
	message = redis_server.rpop("messages")
	if message:
		execute_message(json.loads(message))
