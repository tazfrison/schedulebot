var util = require("util");

var PlayerConversation = require("./player_conversation.js");

function SchedulerConversation()
{
	PlayerConversation.apply(this, arguments);
	this.menuOptions = [
		{label: "List currently scheduled scrims.", action: this.listScrims.bind(this)},
		{label: "Schedule a new scrim.", action: this.schedule.bind(this)},
		{label: "Modify an existing scrim.", action: this.update.bind(this)}
	];
}

util.inherits(SchedulerConversation, PlayerConversation);

SchedulerConversation.prototype.getEvents = function()
{
	var self = this;
	var ids = [];
	if(!self.playsOnPrimary && !self.schedulesForPrimary)
	{
		ids.concat(self.player.playsOn.map(function(team){return team.calendarId;}));
		ids.concat(self.player.schedulesFor.map(function(team){return team.calendarId;}));
	}
	return self.datastore.getEvents(ids);
}

SchedulerConversation.prototype.schedule = function()
{
	//If scheduler for multiple teams, select team
	//What day
		//Reject if no openings
	//What time
		//List available times
	//What server
		//Ours/their default/special
}

SchedulerConversation.prototype.update = function()
{
	//If scheduler for multiple teams, select team
	//List scrims
	//List details of chosen scrim
		//Change date
		//Change time
		//Change location
		//Cancel
}

module.exports = SchedulerConversation;