var util = require("util");

var moment = require("moment");

var PlayerConversation = require("./player_conversation.js");
var Event = require("./calendar.js").Event;

function SchedulerConversation()
{
	var self = this;

	PlayerConversation.apply(this, arguments);
	this.menuOptions = this.menuOptions.concat([
		{label: "Schedule a new scrim.", action: this.schedule.bind(this)},
		{label: "Modify an existing scrim.", action: this.update.bind(this)}
	]);

	this.schedulesForPrimary = false;
	this.player.schedulesFor.every(function(team)
	{
		if(team.primary)
		{
			self.schedulesForPrimary = true;
			return false;
		}
	});
}

util.inherits(SchedulerConversation, PlayerConversation);

SchedulerConversation.prototype.getTeams = function(schedulerOnly)
{
	var teams = this.player.schedulesFor.slice();
	if(!schedulerOnly)
	{
		this.player.playsOn
			.forEach(function(team)
			{
				if(teams.indexOf(team) === -1)
					teams.push(team);
			});
	}
	return teams;
}

SchedulerConversation.prototype.getEvents = function(schedulerOnly)
{
	var self = this;

	var ids = [];
	if(!this.schedulesForPrimary || (!schedulerOnly && this.playsOnPrimary))
	{
		ids = this.getTeams(schedulerOnly).map(function(team){return team.calendarId;});
	}
	return this.datastore.getEvents(ids);
}

SchedulerConversation.prototype.chooseTeam = function(callback)
{
	var self = this;

	var teams = this.getTeams(true);

	this.registerHistory(arguments)

	this.makeMenu({
		label: "What team is this scrim against?",
		listOptions: teams.map(function(team)
		{
			return { label: team.name, action: function()
			{
				self.state.team = team;
				self.state.event = new Event(self.state.team.calendarId);
				self.state.event.setSummary("Scrim vs " + self.state.team.name);
				callback(self.state.team);
			}};
		})
	});
}

SchedulerConversation.prototype.chooseDate = function()
{
	var self = this;

	this.registerHistory(arguments);

	this.handler = function(message)
	{
		if(false)
		{
			self.sendMessage(message + " is not a valid date.  " + output);
		}
		else
		{
			self.state.event.setDate(moment(message, "M/D"));
			if(self.state.event.id)
				self.back();
			else
			{
				self.chooseTime();
			}
		}
	};

	var output = "What date do you want to schedule for? (M/D):";

	this.sendMessage(output);
}

SchedulerConversation.prototype.chooseTime = function()
{
	var self = this;

	this.registerHistory(arguments);

	this.handler = function(message)
	{
		if(false)
		{
			self.sendMessage(message + " is not a valid time.  " + output);
		}
		else
		{
			self.state.event.setTime(moment(message, "H:mm"));
			if(self.state.event.id)
				self.back();
			else
			{
				self.chooseServer();
			}
		}
	};

	var output = "What time on " + this.state.event.start.format("dddd, MMM Do") + "? (H:MM):";

	this.sendMessage(output);
}

SchedulerConversation.prototype.getServer = function(next)
{
	var self = this;

	this.registerHistory(arguments);

	var response = {};
	this.handler = function(message)
	{
		self.registerHistory(false);
		if(message.lastIndexOf("http://", 0) === 0)
		{
			message = message.slice(7);
		}
		response.address = message;
		self.sendMessage("What is the password for :" + response.address);
		self.handler = function(message)
		{
			response.password = message;
			next(self.makeLocationLink(response));
		}
	}
	this.sendMessage("What is the server address?");
}

SchedulerConversation.prototype.chooseServer = function()
{
	var self = this;

	var output;

	this.registerHistory(arguments);
	this.busy();

	Promise.all([
		this.datastore.getTeamLocation(this.datastore.getPrimaryTeam().calendarId),
		this.datastore.getTeamLocation(this.state.event.calendarId || this.state.team.calendarId)
	]).then(function(locations)
	{
		var ourServer = locations[0] || false;
		var theirServer = locations[1] || false;

		var next;

		if(self.state.event.id)
		{
			next = self.back.bind(self);
		}
		else
		{
			next = function()
			{
				self.sendMessage("Requesting scrim.");
				self.emit("schedule", self.state.event);
				self.cancel();
			};
		}

		var options = [
			{ label: "New server.", action: function()
				{
					self.getServer(function(location)
					{
						self.state.event.setLocation(location);
						next();
					});
				}},
			{ label: "Skip for now.", action: function()
				{
					next();
				}
			}
		];

		if(theirServer !== false)
		{

			options.unshift({
				label: self.datastore.getTeam(self.state.event.calendarId).name + ". ( " + theirServer + " )",
				action: function()
				{
					self.state.event.setLocation(theirServer);
					next();
				}
			});
		}

		if(ourServer !== false)
		{
			options.unshift({
				label: self.datastore.getPrimaryTeam().name + ". ( " + ourServer + " )",
				action: function()
				{
					self.state.event.setLocation(ourServer);
					next();
				}
			});
		}

		self.makeMenu({
			label: "What server?",
			listOptions: options
		});
	}, function(err)
	{
		console.log(err, err.stack);
	});
}

SchedulerConversation.prototype.chooseEvent = function()
{
	var self = this;

	this.registerHistory(arguments);

	delete this.state.event;

	this.getEvents().then(function(events)
	{
		self.makeMenu({
			label: "Choose an upcoming scrim:",
			listOptions: events.map(function(event)
			{
				return { label: self.friendlyEvent(event), action: function()
				{
					self.state.event = event;
					self.update();
				}};
			})
		});
	},function(err)
	{
		console.log(err);
	});
}

SchedulerConversation.prototype.schedule = function()
{
	var self = this;
	if(this.schedulesForPrimary || this.player.schedulesFor.length > 1)
	{
		this.chooseTeam(function()
		{
			self.chooseDate.bind(self);
		});
	}
	else
	{
		this.state.team = this.player.schedulesFor[0];
		this.state.event = new Event(this.state.team.calendarId);
		this.state.event.setSummary("Scrim vs " + this.state.team.name);
		this.chooseDate();
	}
}

SchedulerConversation.prototype.update = function()
{
	var self = this;

	if(!this.state.event)
	{
		this.chooseEvent();
		return;
	}

	this.registerHistory(arguments);

	this.makeMenu({
		label: "What do you want to change?",
		listOptions: [
			{ label: "Date: " + this.state.event.start.format("dddd, MMM Do") + ".", action: function ()
				{
					self.chooseDate();
				}},
			{ label: "Time: " + this.state.event.start.format("h:mm A") + ".", action: function ()
				{
					self.chooseTime();
				}},
			{ label: "Location: " + this.state.event.location + ".", action: function ()
				{
					self.chooseServer();
				}},
			{ label: "Request changes.", action: function ()
				{
					self.sendMessage("Requesting reschedule.");
					self.emit("reschedule", self.state.event);
					self.cancel();
				}},
			{ label: "Cancel scrim.", action: function ()
				{
					self.sendMessage("Scrim cancelled.");
					self.emit("cancel", self.state.event);
					self.cancel();
				}}
		]
	});
}

module.exports = SchedulerConversation;