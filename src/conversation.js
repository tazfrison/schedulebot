var util = require("util");
var EventEmitter = require("events");

var moment = require("moment");

function Conversation (id, datastore, sendMessage)
{
	var self = this;
	this.player = datastore.teamdata.getPlayer(id);
	this.chatid = id;
	this.datastore = datastore;
	this.log = this.datastore.getLog(this.chatid);

	this.sendMessage = sendMessage;

	this.commands = {
		"commands": function()
		{
			self.sendMessage("Available commands:\n!" + Object.keys(self.commands).join("\n!"));
		},
		"whoami": this.whoami.bind(this)
	};

	this.playsOnPrimary = false;
	this.player.playsOn.every(function(team)
	{
		if(team.primary)
		{
			self.playsOnPrimary = true;
			return false;
		}
	});
	this.schedulesForPrimary = false;
	this.player.schedulesFor.every(function(team)
	{
		if(team.primary)
		{
			self.schedulesForPrimary = true;
			return false;
		}
	});

	EventEmitter.call(this);
}

util.inherits(Conversation, EventEmitter);

Conversation.prototype.handleMessage = function(message)
{
	if(message[0] === "!")
		this.handleCommand(message);
	else
		this.handler(message);
}

Conversation.prototype.handleCommand = function(message)
{
	var input = message.split(" ", 1)[0].slice(1);
	if(typeof this.commands[input] === "function")
		this.commands[input](message);
	else
	{
		this.sendMessage(input + " is not a recognized command.");
	}
}

Conversation.prototype.whoami = function()
{
	var message = "Your name is " + this.player.name + ".  ";
	var teamMap = function(team)
	{
		return "'" + team.name + "'";
	};
	if(this.player.admin)
		message += "You are an admin.  ";
	if(this.player.schedulesFor.length > 0)
	{
		message += "You schedule for the team"
			+ ( this.player.schedulesFor.length !== 1 ? "s " : " ")
			+ this.player.schedulesFor.map(teamMap).join(", ") + ".  ";
	}
	if(this.player.playsOn.length > 0)
	{
		message += "You play on the team"
			+ ( this.player.playsOn.length !== 1 ? "s " : " ")
			+ this.player.playsOn.map(teamMap).join(", ") + ".  ";
	}
	this.sendMessage(message);
}

Conversation.friendlyEvent = function(event)
{
	return event.start.format("M-D H:mm - ") + event.summary;
}

module.exports = Conversation;