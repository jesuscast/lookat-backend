forever start web_server.js -l $(pwd)/web_server.log -e $(pwd)/web_server.log -o $(pwd)/web_server.log --pidFile $(pwd)/web_server.pid --uid web_server --append --workingDir $(pwd)
