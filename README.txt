This requires redis to be installed.


Instructions:
1. First we need to have virtualenv
pip install virtualenv
2. Then create an environment and populate it with the packages under requirements.
virtualenv env
source env/bin/activate
pip install -r requirements.txt


/* Configuration set up as from http://redis.io/topics/quickstart */
Redis Log File:
logfile /var/log/redis_6379.lof
Redis Port: 6379
Redis Configuration File: /etc/redis/6379.conf

To start:
sudo /etc/init.d/redis_6379 start