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

http://testrtc.com/

https://webrtc.github.io/samples/src/content/getusermedia/gum/

1
2
ffmpeg -i YOUR-FILE-HERE.mp4 -pix_fmt yuv420p
sed -i '0,/C420mpeg2/s//C420/' *.y4m

// In order to run it in the browser with simulated video
/Applications/Chromium.app/Contents/MacOS/Chromium --use-fake-device-for-media-stream --use-file-for-fake-video-capture=/Users/macbook/Documents/lookat/backend/bowing_qcif.y4m

alias chrome="rm -rf $HOME/.config/chrome-test && google-chrome --console --no-first-run --user-data-dir=$HOME/.config/chrome-test --use-fake-device-for-media-stream --use-file-for-fake-video-capture=/home/doehlman/testvideo.y4m --enable-logging --v=1 --vmodule=*third_party/libjingle/*=3,*=0"

// Runing chromium on Linux
chromium-browser --remote-debugging-port=9222

ffmpeg -i me.mov -pix_fmt yuv420p