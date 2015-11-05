var util = require("util");

var moment = require("moment");

var SchedulerConversation = require("./scheduler_conversation.js");
var Event = require("./calendar.js").Event;

function AdminConversation()
{
	SchedulerConversation.apply(this, arguments);
}

util.inherits(AdminConversation, SchedulerConversation);

AdminConversation.prototype.getEvents = function()
{
	return this.datastore.getEvents();
}

AdminConversation.prototype.getTeams = function(schedulerOnly)
{
	return this.datastore.teamdata.teams.slice().filter(function(team)
		{
			return !team.primary;
		});
}

AdminConversation.prototype.schedule = function()
{
	this.chooseTeam(this.chooseDate.bind(this));
}

module.exports = AdminConversation;