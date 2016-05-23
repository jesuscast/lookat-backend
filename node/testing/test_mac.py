# Browser interactions
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from pyvirtualdisplay import Display
# Utilities
import os
import time
import sys
testing = False

if not testing:
	display = Display(visible = 0, size=(1024, 768))
	display.start()

video_path = os.getcwd()+"/"+ "me_t.y4m"
audio_path = os.getcwd()+"/"+ "me_s.wav"

initial_url = "http://localhost:3000/"

chrome_options = Options()
chrome_options.add_argument("--use-fake-device-for-media-stream")
chrome_options.add_argument("--always-authorize-plugins")
chrome_options.add_argument("--use-fake-ui-for-media-stream")
chrome_options.add_argument("--use-file-for-fake-audio-capture="+audio_path)
chrome_options.add_argument("--use-file-for-fake-video-capture="+video_path)

driver = webdriver.Chrome(chrome_options=chrome_options)

driver.get(initial_url)

while True:
	print 'Still alive'
	print time.ctime()
	sys.stdout.flush()
	time.sleep(60)