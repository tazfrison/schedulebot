var EventEmitter = require("events");
var util = require("util");

var moment = require("moment");
var Promise = require("promise");

function Conversation (id, datastore, sendMessage)
{
	var self = this;
	this.player = datastore.getPlayer(id);
	this.chatid = id;
	this.datastore = datastore;
	this.log = this.datastore.getLog(this.chatid);

	this.sendMessage = sendMessage;

	this.commands = {
		"commands": { action: function()
		{
			self.sendMessage("Available commands:\n\t!" + Object.keys(self.commands).join("\n\t!"));
		}, help: "Lists available commands.  Commands can be accessed at any point and generally do not rely on current menu position." },
		"whoami": { action: this.whoami.bind(this), help: "Gives what information the schedulebot has about who you are." },
		"cancel": { action: this.cancel.bind(this), help: "Ends the current menu process and goes back to the main menu." },
		"back": { action: this.back.bind(this), help: "Goes back to the last valid menu.  Some menus are skipped when going backwards." },
		"help": { action: this.help.bind(this), help: "Gives information on how to use the schedulebot.  Type '!help <command>' to get information on another command." }
	};

	this.state = {};
	this.pending = [];
	this.history = [];
	this.handler = this.resume.bind(this);

	EventEmitter.call(this);
}

util.inherits(Conversation, EventEmitter);

Conversation.prototype.cancel = function()
{
	this.state = {};
	this.mainmenu();
}

Conversation.prototype.back = function()
{
	if(this.history.length > 1)
	{
		this.history.pop();
		var history;
		do
		{
			history = this.history[this.history.length - 1];
			this.history.pop();
		} while(history === false && this.history.length > 1);
		history.state.apply(this, history.arguments);
	}
	else
		this.cancel();
}

Conversation.prototype.registerHistory = function(args)
{
	if(args === false)
		this.history.push(false);
	else
		this.history.push({state: args.callee, arguments: args});
}

Conversation.prototype.busy = function()
{
	var self = this;
	this.handler = function()
	{
		self.sendMessage("Please wait, the bot is busy.");
	}
}

Conversation.prototype.delegate = function(subConversation)
{
	this.handleMessage = function(message)
	{
		subConversation.handleMessage(message);
	}
	subConversation.mainmenu();
}

Conversation.prototype.interrupt = function(incoming)
{
	var self = this;
	this.busy();
	if(typeof incoming === "string")
	{
		this.sendMessage(incoming);
		this.resume();
		return;
	}
	this.makeMenu({
		label: incoming.label,
		listOptions: [
			{ label: "Handle now.", action: function()
				{
					self.delegate(incoming.action);
				}},
			{ label: "Save for later.", action: function()
				{
					self.pending.push(incoming);
					self.resume();
				}}
		]
	});
}

Conversation.prototype.resume = function()
{
	var self = this;
	this.handleMessage = function(message)
	{
		if(message[0] === "!")
			self.handleCommand(message);
		else
			self.handler(message);
	}
	var history = this.history.pop();
	if(!history)
	{
		this.cancel();
		return;
	}
	history.state.apply(this, history.arguments);
}

Conversation.prototype.help = function(command)
{
	if(command)
	{
		if(command.charAt(0) === "!")
			command = command.slice(1);
		if(this.commands[command])
		{
			if(this.commands[command].help)
				this.sendMessage(this.commands[command].help);
			else
				this.sendMessage(command + " has no help instructions.");
		}
		else
		{
			this.sendMessage(command + " is not a valid command.");
		}
	}
	else
	{
		this.sendMessage("Can you be helped?");
	}
}

Conversation.prototype.makeMenu = function(properties)
{
	var self = this;
	this.busy();

	var resolve = function(value)
	{
		if(typeof value === "function")
			value = value();
		return Promise.resolve(value);
	};

	var next = function(options)
	{
		var counter = 0;
		var output = options.label
			+ "\n\t" + options.listOptions
				.map(function(option)
				{
					return ++counter + ": "
						+ option.label;
				})
				.join("\n\t");
		self.handler = function(message)
		{
			var input = message * 1 - 1;
			if(!isNaN(input) && input >= 0 && input < options.listOptions.length)
				options.listOptions[input].action();
			else
				self.sendMessage(message + " is invalid.  " + output);

		};
		self.sendMessage(output);
	};

	resolve(properties).then(next,
		function(error)
		{
			throw error;
		});
}

Conversation.prototype.mainmenu = function()
{
	this.history = [];
	this.registerHistory(arguments);

	this.makeMenu({
		label: "Main menu:",
		listOptions: this.menuOptions
	});
}

Conversation.prototype.listPending = function()
{
	var self = this;
	if(this.pending.length === 0)
	{
		this.sendMessage("No pending messages.");
		this.cancel();
		return;
	}
	this.registerHistory(arguments);
	this.makeMenu({
		label: "",
		listOptions: this.pending.map(function(pending)
		{
			return function()
			{
				self.delegate(pending);
			}
		})
	});
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
	if(typeof this.commands[input].action === "function")
		this.commands[input].action(message.split(" ").slice(1).join(" "));
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

Conversation.prototype.makeLocationLink = function(location)
{
	return "steam://connect/" + location.address + "/" + location.password;
}

module.exports = Conversation;