var Steam = require("steam");
var fs = require("fs");
var crypto = require("crypto");
var readline = require("readline");
var Conversation = require("./conversation.js");

var serverFile = "resources/servers";
var confFile = "resources/login.conf";

function ScheduleBot()
{
	this.init();

	this.client = new Steam.SteamClient();
	this.friends = new Steam.SteamFriends(this.client);
	this.user = new Steam.SteamUser(this.client);

	this.setupHandlers();

	this.client.connect();
}

ScheduleBot.prototype.init = function()
{
	if(fs.existsSync(serverFile))
	{
		Steam.servers = JSON.parse(fs.readFileSync(serverFile));
	}
	if(fs.existsSync(confFile))
	{
		var config = JSON.parse(fs.readFileSync(confFile));
	}
	else
	{
		console.log("Config file not found.");
		process.exit();
	}
	this.username = config.username;
	this.password = config.password;
	//this.sentryFile = "resources/bot." + this.username + ".sentry";

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
	this.friends.setPersonaState(Steam.EPersonaState.Online);
	this.rl.on("line", this.handleCommand.bind(this));
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
	}
}

ScheduleBot.prototype.getUserName = function(id)
{
	return (this.friends.personaStates && id in this.friends.personaStates)
		? (this.friends.personaStates[id].player_name)
		: "";
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
	fs.writeFile(serverFile, JSON.stringify(servers));
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
	fs.writeFileSync(this.sentryFile, sentry.bytes);
	callback({
		sha_file: crypto.createHash('sha1').update(sentry.bytes).digest()
	});
}

ScheduleBot.prototype.onFriendRelationships = function()
{
	var self = this;
	console.log(this.friends.friends);
	Object.keys(this.friends.friends).forEach(function(id)
	{
		if(self.friends.friends[id] === Steam.EFriendRelationship.RequestRecipient)
		{
			console.log("Accepting friend: " + self.getUserName(id));
			//self.friends.addFriend(id);
		}

	});
	return;
	this.friends.requestFriendData(Object.keys(this.friends.friends), 
		Steam.EClientPersonaStateFlag.QueryPort |
		Steam.EClientPersonaStateFlag.SourceID |
		Steam.EClientPersonaStateFlag.Presence |
		Steam.EClientPersonaStateFlag.Metadata |
		Steam.EClientPersonaStateFlag.ClanInfo |
		Steam.EClientPersonaStateFlag.ClanTag
	);
}

ScheduleBot.prototype.onFriendPersonaState = function(state)
{
	//console.log(state);
}

ScheduleBot.prototype.onFriendMessage = function(steamId, message, type)
{
	console.log("Received message: '" + message + "' from " + steamId);
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

var bot = new ScheduleBot();