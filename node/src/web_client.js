// Controls the connections to the client in order to make twilio work.

// Utility to generate uuid
let guid = () => {
	let s4 = () => {
		return Math.floor((1 + Math.random()) * 0x10000)
	      .toString(16)
	      .substring(1);
	};
	return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
    s4() + '-' + s4() + s4() + s4();
};

// Global variable that contains the data to send to the socket connetion

let data_to_send = {};
let token = "";
// Socket connection.
let socket = io();

// This unique identifier
let this_guid = guid();

// Twilio Variables
let conversationsClient;
let activeConversation;
let previewMedia;
let identity = this_guid;

// Coordinates
// My home

// General location functions.
let coords_lat = 37.4241385; 
let coords_long = -122.1709075;

let obtain_position = () => {
	navigator.geolocation.getCurrentPosition((position)=> {
		coords_lat = position.coords.latitude;
		coords_long = position.coords.longitude;
		window.coords_lat = coords_lat;
		window.coords_long = coords_long;
	});
};

let send_message = (msg, dictionary_data) => {
	socket.emit(msg, JSON.stringify(dictionary_data));
};

let send_guid = () => {
	send_message("uuid_received", { "content": this_guid, "type": "uuid_received" });
};


// Standard functions for communicating with the server.
let join_chat = () => {
	send_message("join",
    	{
    		"content" : this_guid,
    		"type" : "join",
    		"lat" : coords_lat.toString(),
    		"long" : coords_long.toString()
    	}
    );
};

let try_to_match = () => {
	send_message("try_to_match",
		{
			"type" : "try_to_match"
		}
	);
};

let accept = () => {
	send_message("accepted",
		{
			"type" : "accepted"
		}
	);
};

let back_into_queue = () => {
	send_message("back_into_queue",
		{
			"type" : "back_into_queue"
		}
	);
};


let connect_to_twilio = () => {
	let accessManager = new Twilio.AccessManager(token);
	conversationsClient = new Twilio.Conversations.Client(accessManager);
	conversationsClient.listen().then(clientConnected, function (error) {
        console.log('Could not connect to Twilio: ' + error.message);
    });
};

// Successfully connected!

let clientConnected = () => {
    console.log("Connected to Twilio. Listening for incoming Invites as '" + conversationsClient.identity + "'");

    conversationsClient.on('invite', function (invite) {
        console.log('Incoming invite from: ' + invite.from);
        invite.accept().then(conversationStarted);
    });

};

// let conversationStarted = (conversation) => {
// 	console.log('I am in a conversation.')
// };

let conversationStarted = (conversation) => {
    console.log('In an active Conversation');
    accept();
    activeConversation = conversation;
    // Draw local video, if not already previewing
    if (!previewMedia) {
        conversation.localMedia.attach('#local-media');
    }

    // When a participant joins, draw their video on screen
    conversation.on('participantConnected', function (participant) {
        console.log("Participant '" + participant.identity + "' connected");
        // participant.media.attach('#remote-media');
    });

    // When a participant disconnects, note in log
    conversation.on('participantDisconnected', function (participant) {
    	back_into_queue()
        console.log("Participant '" + participant.identity + "' disconnected");
    });

    // When the conversation ends, stop capturing local video
    conversation.on('disconnected', function (conversation) {
        console.log("Connected to Twilio. Listening for incoming Invites as '" + conversationsClient.identity + "'");
        conversation.localMedia.stop();
        conversation.disconnect();
        activeConversation = null;
        back_into_queue();
    });
}

// Handlers for data received from the server.
socket.on("connection_received", (data) => {
	let data_received = JSON.parse(data);
	token = data_received.token;
});
socket.on("ready_to_match", (data) => {
	let data_received = JSON.parse(data);
});
socket.on("continue_conversation", (data) => {
	let data_received = JSON.parse(data);
});
socket.on("partner_disconnected", (data) => {
	let data_received = JSON.parse(data);
});
socket.on("matched", (data) => {
	let data_received = JSON.parse(data);
	if(data_received.hasOwnProperty('type')) {
		if(data_received.hasOwnProperty('content')) {
			if(data_received.hasOwnProperty('role')) {
				if(data_received['role'] == 'send_invite'){
					    // Create a conversation
					    let options = {};
					    if (previewMedia) {
					        options.localMedia = previewMedia;
					    }
					    conversationsClient.inviteToConversation(data_received['content'], options).then(conversationStarted, (error) => {
					        console.log('Unable to create conversation');
					        console.error('Unable to create conversation', error);
					    });
				} //end send invite
			} // end there is a role
		} // end there is content
	} // end there is type
});



if (!previewMedia) {
    previewMedia = new Twilio.Conversations.LocalMedia();
    Twilio.Conversations.getUserMedia().then(
    (mediaStream) => {
        previewMedia.addStream(mediaStream);
        previewMedia.attach('#local-media');
    },
    (error) => {
        console.error('Unable to access local media', error);
        console.log('Unable to access Camera and Microphone');
    });
};


send_guid();
setTimeout(connect_to_twilio, 1000)
setTimeout(join_chat ,1500);























