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
			self.sendMessage("Available commands:\n\t!" + Object.keys(self.commands).join("\n\t!"));
		},
		"whoami": this.whoami.bind(this),
		"cancel": this.cancel.bind(this)
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

	this.state = {};

	this.handler = this.mainmenu.bind(this);
}

Conversation.prototype.cancel = function()
{
	this.state = {};
	this.mainmenu();
}

Conversation.prototype.mainmenu = function()
{
	var self = this;

	var counter = 1;
	var output = "\n" + this.menuOptions
		.map(function(option){return "\t" + counter++ + ": " + option.label;})
		.join("\n");
	this.handler = function(message)
	{
		var input = message * 1;
		if(!isNaN(input) && input > 0 && input <= self.menuOptions.length)
			self.menuOptions[input - 1].action();
		else
			self.sendMessage("Option '" + message + "' not recognized.  Please choose from the list.");

	};
	this.sendMessage(output);
}

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

Conversation.prototype.friendlyEvent = function(event)
{
	return event.start.format("M-D H:mm - ") + event.summary;
}

module.exports = Conversation;