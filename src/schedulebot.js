var Steam = require("steam");
var fs = require("fs");
var crypto = require("crypto");
var readline = require("readline");
var Conversation = require("./conversation.js");

function ScheduleBot(datastore)
{
	var self = this;
	this.datastore = datastore;

	this.datastore.init().then(function()
	{
		self.init();
	},
	function(err)
	{
		console.log("ScheduleBot failed to initialize: " + err);
	});
}

ScheduleBot.prototype.init = function()
{
	var config = this.datastore.getSteamLogin();
	if(!config)
	{
		console.log("Config file not found.");
		process.exit();
	}
	this.username = config.username;
	this.password = config.password;

	config = this.datastore.getServers();
	if(!config)
	{
		Steam.servers = config;
	}

	this.rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout
	});

	this.conversations = {};
	this.pending = {};

	this.client = new Steam.SteamClient();
	this.friends = new Steam.SteamFriends(this.client);
	this.user = new Steam.SteamUser(this.client);
	this.me = false;

	this.setupHandlers();

	this.client.connect();
}

ScheduleBot.prototype.setupHandlers = function()
{
	this.client.on("connected", this.onClientConnect.bind(this));
	this.client.on('servers', this.onClientServers.bind(this));
	this.client.on("logOnResponse", this.onClientLogOn.bind(this));
	this.client.on("loggedOff", this.onClientLogOff.bind(this));

	//this.user.on("updateMachineAuth", this.onUserUpdateMachineAuth.bind(this));

	this.friends.on("friendMsg", this.onFriendMessage.bind(this));
	this.friends.on("relationships", this.onFriendRelationships.bind(this));
	this.friends.on("personaState", this.onFriendPersonaState.bind(this));
}

ScheduleBot.prototype.loggedOn = function()
{
	var self = this;
	this.friends.once("relationships", function()
	{
		self.friends.setPersonaState(Steam.EPersonaState.Online);
		self.rl.on("line", self.handleCommand.bind(self));
	});
}

ScheduleBot.prototype.handleCommand = function(command)
{
	if(command === "exit")
	{
		this.rl.close();
		this.client.disconnect();
		process.exit();
	}
	else if(command === "listfriends")
	{
		this.listFriends();
	}
	else if(command.lastIndexOf("acceptfriend", 0) === 0)
	{
		var id = command.split(" ", 2)[1];
		this.friends.addFriend(id);
	}
	else if(command.lastIndexOf("get", 0) === 0)
	{
		var id = command.split(" ", 2)[1];
		this.friends.requestFriendData([id], 1);
	}
	else if(command.lastIndexOf("message", 0) === 0)
	{
		command = command.split(" ");
		var id = command[1];
		this.friends.sendMessage(id, command.slice(2).join(" "), Steam.EChatEntryType.ChatMsg);
	}
	else if(command === "listevents")
	{
		this.datastore.calendar.listEvents();
	}
}

ScheduleBot.prototype.getUserName = function(id)
{
	return (this.friends.personaStates && id in this.friends.personaStates)
		? (this.friends.personaStates[id].player_name)
		: "";
}

ScheduleBot.prototype.listFriends = function()
{
	console.log(this.friends.personaStates);
}

ScheduleBot.prototype.acceptFriend = function(id)
{
	if(this.datastore.teamdata.getPlayer(id))
	{
		console.log("Accepting friend: " + this.getUserName(id) + "(" + id + ")");
		this.friends.addFriend(id);
	}
	else
	{
		console.log("Player not in config: " + this.getUserName(id) + "(" + id + ")");
	}
}

ScheduleBot.prototype.onClientConnect = function()
{
	console.log("Connected");
	this.user.logOn({
		account_name: this.username,
		password: this.password
	});
}

ScheduleBot.prototype.onClientServers = function(servers)
{
	this.datastore.setServers(servers);
}

ScheduleBot.prototype.onClientLogOn = function(response)
{
	if(response.eresult !== 1)
	{
		console.log("Logon error: ", response);
	}
	console.log("Logged on");
	this.loggedOn();
}

ScheduleBot.prototype.onClientLogOff = function(response)
{
	console.log("Logged off: ", response);
}

ScheduleBot.prototype.onUserUpdateMachineAuth = function(sentry, callback)
{
	this.datastore.setSentry(this.username, sentry.bytes);
	callback({
		sha_file: crypto.createHash('sha1').update(sentry.bytes).digest()
	});
}

ScheduleBot.prototype.onFriendRelationships = function()
{
	var self = this;
	var unknowns = [];
	Object.keys(this.friends.friends).forEach(function(id)
	{
		self.onFriendFriend(id, self.friends.friends[id]);
	});
	if(unknowns.length > 0)
	{
		this.friends.requestFriendData(unknowns);
	}
}

ScheduleBot.prototype.onFriendFriend = function(id, relationship)
{
	if(relationship === Steam.EFriendRelationship.RequestRecipient)
	{
		if(this.getUserName(id) !== "")
		{
			this.acceptFriend(id);
		}
		else
		{
			var self = this;
			if(!this.pending[id])
				this.pending[id] = [];
			this.pending[id].push(function()
			{
				setTimeout(function()
				{
					self.acceptFriend(id);
				});
			});
			this.friends.requestFriendData([id]);
		}
	}
}

ScheduleBot.prototype.onFriendPersonaState = function(state)
{
	if(this.pending[state.friendid])
	{
		while(this.pending[state.friendid].length > 0)
		{
			this.pending[state.friendid].pop()();
		}
		delete this.pending[state.friendid];
	}
	if(this.conversations[state.friendid])
	{
		this.conversations[state.friendid].updateState(state);
	}
	else if(state.friendid === this.client.steamID)
	{
		this.me = state;
	}
}

ScheduleBot.prototype.onFriendMessage = function(steamId, message, type)
{
	console.log("Received message: '" + message + "' from " + this.getUserName(steamId));
	if(message == "")
		return;
	if(!this.conversations[steamId])
	{
		var self = this;
		this.conversations[steamId] = new Conversation(
			this.me,
			this.friends.personaStates[steamId],
			this.datastore, function(message)
			{
				self.friends.sendMessage(steamId, message, Steam.EChatEntryType.ChatMsg);
			});
	}
	this.conversations[steamId].handleMessage(message);
}

module.exports = ScheduleBot;