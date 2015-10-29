var Steam = require("steam");
var fs = require("fs");
var crypto = require("crypto");
var readline = require("readline");
var Conversation = require("./conversation.js");

function ScheduleBot(datastore)
{
	this.datastore = datastore;
	this.init();

	this.client = new Steam.SteamClient();
	this.friends = new Steam.SteamFriends(this.client);
	this.user = new Steam.SteamUser(this.client);

	this.setupHandlers();

	this.client.connect();
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
	switch(command)
	{
		case "exit":
			this.rl.close();
			this.client.disconnect();
			process.exit();
			break;
		case "listfriends":
			this.listFriends();
			break;
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
	console.log("Accepting friend: " + this.getUserName(id));
	//this.friends.addFriend(id);
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
	console.log(this.friends.friends);
	var unknowns = [];
	Object.keys(this.friends.friends).forEach(function(id)
	{
		if(self.friends.friends[id] === Steam.EFriendRelationship.RequestRecipient)
		{
			if(self.getUserName(id) !== "")
			{
				self.acceptFriend(id);
			}
			else
			{
				console.log("Looking up: " + id);
				unknowns.push(id);
			}
		}
	});
	if(unknowns.length > 0)
	{
		var callback = function(state)
		{
			var index = unknowns.indexOf(state.friendid);
			if(index >= 0)
			{
				unknowns.splice(index, 1);
				setTimeout(function()
				{
					//Friends persona state updates after this event
					self.acceptFriend(state.friendid);
				});
			}
			if(unknowns.length === 0)
			{
				self.friends.removeListener("personaState", callback);
				
			}
		}
		this.friends.on("personaState", callback);
		this.friends.requestFriendData(unknowns);
	}
}

ScheduleBot.prototype.onFriendPersonaState = function(state)
{
	//console.log(state);
}

ScheduleBot.prototype.onFriendMessage = function(steamId, message, type)
{
	console.log("Received message: '" + message + "' from " + this.getUserName(steamId));
	if(!this.conversations[steamId])
	{
		var self = this;
		this.conversations[steamId] = new Conversation(steamId, function(message)
		{
			self.friends.sendMessage(steamId, message, Steam.EChatEntryType.ChatMsg);
		});
	}
	this.conversations[steamId].handleMessage(message);
}

module.exports = ScheduleBot;