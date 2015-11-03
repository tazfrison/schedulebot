var util = require("util");

var Conversation = require("./conversation.js");

function AdminConversation()
{
	Conversation.apply(this, arguments);
	this.handler = this.mainmenu.bind(this);
}

util.inherits(AdminConversation, Conversation);

AdminConversation.prototype.mainmenu = function()
{
	var self = this;
	this.sendMessage("\n\
1: List currently scheduled scrims.\n\
2: Schedule a new scrim.\n\
3: Modify an existing scrim.");
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
				self.update();
			default:
				self.sendMessage("Option '" + message + "' not recognized.  Please choose from the list.");
				break;
		}
	};
}

AdminConversation.prototype.listScrims = function()
{
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

AdminConversation.prototype.schedule = function()
{
	//What day
		//Reject if no openings
	//What time
		//List available times
	//What server
		//Ours/their default/special
}

AdminConversation.prototype.update = function()
{
	//List scrims for all teams
	//List details of chosen scrim
		//Change date
		//Change time
		//Change location
		//Cancel
}

module.exports = AdminConversation;