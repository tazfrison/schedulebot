var util = require("util");

var Conversation = require("./conversation.js");

function PlayerConversation()
{
	Conversation.apply(this, arguments);
	this.handler = this.mainmenu.bind(this);
}

util.inherits(PlayerConversation, Conversation);

PlayerConversation.prototype.mainmenu = function()
{
	var self = this;
	this.sendMessage("\n\
1: List currently scheduled scrims.");
	this.handler = function(message)
	{
		switch(message)
		{
			case "1":
				self.listScrims();
				break;
			default:
				self.sendMessage("Option '" + message + "' not recognized.  Please choose from the list.");
				break;
		}
	};
}

PlayerConversation.prototype.listScrims = function()
{
	//List scrims for each team they're a player on
	var self = this;
	this.datastore.calendar.getEvents().then(function(events)
	{
		var output = "Upcoming scrims:\n" + events.map(function(event)
		{
			return Conversation.friendlyEvent(event);
		}).join("\n");
		self.sendMessage(output);
	},
	function(err)
	{
		console.log(err);
	});
}

module.exports = PlayerConversation;