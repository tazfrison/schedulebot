var util = require("util");

var Conversation = require("./conversation.js");

function PlayerConversation()
{
	Conversation.apply(this, arguments);
	this.menuOptions = [
		{label: "List currently scheduled scrims.", action: this.listScrims.bind(this)}
	];
}

util.inherits(PlayerConversation, Conversation);

PlayerConversation.prototype.getEvents = function()
{
	var ids = [];
	if(!this.playsOnPrimary)
	{
		ids = this.player.playsOn.map(function(team){return team.calendarId;});
	}
	return this.datastore.getEvents(ids);
}

PlayerConversation.prototype.listScrims = function()
{
	var self = this;
	this.handler = this.busy.bind(this);
	this.getEvents().then(function(events)
	{
		var output = "Upcoming scrims:\n\t" + events.map(self.friendlyEvent).join("\n\t");
		self.sendMessage(output);
		self.mainmenu();
	},
	function(err)
	{
		console.log(err);
	});
}

module.exports = PlayerConversation;