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

PlayerConversation.prototype.listScrims = function()
{
	var self = this;
	var ids = [];
	if(!this.playsOnPrimary)
	{
		ids = this.player.playsOn.map(function(team){return team.calendarId;});
	}
	this.datastore.getEvents(ids).then(function(events)
	{
		var output = "Upcoming scrims:\n\t" + events.map(Conversation.friendlyEvent).join("\n\t");
		self.sendMessage(output);
	},
	function(err)
	{
		console.log(err);
	});
}

module.exports = PlayerConversation;