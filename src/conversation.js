var util = require("util");
var EventEmitter = require("events");

var moment = require("moment");

function Conversation (me, them, datastore, sendMessage)
{
	var self = this;
	this.chatid = them.friendid;
	this.me = me;
	this.them = them;
	this.datastore = datastore;
	this.log = this.datastore.getLog(this.chatid);
	this.sendMessage = function(message)
	{
		self.log.write(self.me.player_name, message);
		sendMessage(message);
	};

	this.handler = this.printOptions.bind(this);

	EventEmitter.call(this);
}

util.inherits(Conversation, EventEmitter);

Conversation.prototype.handleMessage = function(message)
{
	this.log.write(this.them.player_name, message);
	this.handler(message);
}

Conversation.prototype.updateState = function(state)
{
	this.them = state;
}

Conversation.prototype.printOptions = function()
{
	var self = this;
	this.sendMessage("\n\
1: List currently scheduled scrims.\n\
2: Schedule a new scrim.\n\
3: Reschedule an existing scrim.\n\
4: Cancel a scrim.");
	this.handler = function(message)
	{
		switch(message)
		{
			case "1":
				self.listScrims();
				break;
			case "2":
				self.schedule();
				break;
			case "3":
				self.reschedule();
			case "4":
				self.cancel();
				break;
			default:
				self.sendMessage("Option '" + message + "' not recognized.  Please choose from the list.");
				break;
		}
	};
}

Conversation.prototype.listScrims = function()
{
	console.log("List");
	var self = this;
	this.datastore.calendar.getEvents().then(function(events)
	{
		var output = "Upcoming scrims:\n" + events.map(function(event)
		{
			return friendlyEvent(event);
		}).join("\n");
		self.sendMessage(output);
	},
	function(err)
	{
		console.log(err);
	});
}

Conversation.prototype.schedule = function()
{
	console.log("Schedule");
}

Conversation.prototype.reschedule = function()
{
	console.log("Reschedule");
}

Conversation.prototype.cancel = function()
{
	console.log("Cancel");
}

function friendlyEvent(event)
{
	return event.start.format("M-D H:mm - ") + event.summary;
}

module.exports = Conversation;