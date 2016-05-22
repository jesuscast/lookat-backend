# Browser interactions
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
# Utilities
import os

video_path = os.getcwd()+"/"+ "carphone_qcif.y4m"
initial_url = "http://localhost:3000/"

chrome_options = Options()
chrome_options.add_argument("--use-fake-device-for-media-stream")
chrome_options.add_argument("--always-authorize-plugins")
chrome_options.add_argument("--use-fake-ui-for-media-stream")
chrome_options.add_argument("--use-file-for-fake-video-capture="+video_path)

driver = webdriver.Chrome(chrome_options=chrome_options)

driver.get(initial_url)