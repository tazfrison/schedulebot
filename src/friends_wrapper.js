var fs = require("fs");
var util = require("util");
var path = require("path");

var moment = require("moment");
var Steam = require("steam");

var resources = path.join(path.dirname(fs.realpathSync(__filename)), "../resources");
var logs = path.join(resources, "logs");

function FriendsWrapper(client)
{
	Steam.SteamFriends.apply(this, arguments);

	var self = this;
	this.once("relationships", function()
	{
		Object.keys(self.friends).forEach(function(id)
		{
			self.onFriend(id, self.friends[id]);
		});
		self.setPersonaState(Steam.EPersonaState.Online);
		self.selfId = client.steamID;
		self.emit("ready");
	});
	this.logfiles = {};
}

util.inherits(FriendsWrapper, Steam.SteamFriends);

FriendsWrapper.prototype.setupHandlers = function()
{
	this.on("friend", this.onFriend.bind(this));
	this.on("personaState", this.onPersonaState.bind(this));
	this.on("friendMsg", this.onFriendMessage.bind(this));
}

FriendsWrapper.prototype.onFriend = function(id, relationship)
{
	if(relationship === Steam.EFriendRelationship.RequestRecipient)
		this.emit("requestReceived", id);
}

FriendsWrapper.prototype.onPersonaState = function(state)
{
	var id = state.friendid;
	var previousState = this.personaStates[id];
	if(!previousState)
	{
		this.emit(id + ".newData", state);
		return;
	}
	if(previousState.player_name !== state.player_name)
		this.emit("nameChange", state);
	if(previousState.persona_state !== state.persona_state)
	{
		if(previousState.persona_state === Steam.EPersonaState.Offline)
			this.emit(id + ".online", state);
		else if(state.persona_state === Steam.EPersonaState.Offline)
			this.emit(id + ".offline", state);
	}
}

FriendsWrapper.prototype.onFriendMessage = function(steamId, message, type)
{
	if(message == "")
		return;
	var log = this.getLog(steamId);
	log.write(this.getUserName(steamId), message);
}

FriendsWrapper.prototype.getStatus = function(steamId)
{
	if(!this.personaStates[steamId])
		return Steam.EPersonaState.Offline;
	else
		return this.personaStates[steamId].persona_state;
}

FriendsWrapper.prototype.getUserName = function(id)
{
	return (this.personaStates && id in this.personaStates)
		? (this.personaStates[id].player_name)
		: "";
}

FriendsWrapper.prototype.sendMessage = function(steamId, message)
{
	var log = this.getLog(steamId);
	log.write(this.getUserName(this.selfId), message);
	FriendsWrapper.super_.prototype.sendMessage.call(this, steamId, message, Steam.EChatEntryType.ChatMsg);
}

/* **********************************
             CHAT LOGGING
********************************** */

FriendsWrapper.prototype.getLog = function(id)
{
	if(!this.logfiles[id])
		this.logfiles[id] = new Log(id);
	return this.logfiles[id];
}

function Log(id)
{
	this.path = path.join(logs, id + ".log");

}

Log.prototype.write = function(name, message)
{
	var output = "[" + moment().format("HH:mm:ss A") + "] " + name + ": " + message + "\n";

	fs.appendFile(this.path, output);
}

module.exports = FriendsWrapper;