var util = require("util");

var moment = require("moment");

var PlayerConversation = require("./player_conversation.js");
var Event = require("./calendar.js").Event;

function SchedulerConversation()
{
	PlayerConversation.apply(this, arguments);
	this.menuOptions = this.menuOptions.concat([
		{label: "Schedule a new scrim.", action: this.schedule.bind(this)},
		{label: "Modify an existing scrim.", action: this.update.bind(this)}
	]);
}

util.inherits(SchedulerConversation, PlayerConversation);

SchedulerConversation.prototype.cancel = function()
{
	delete this.state.event;
	this.mainmenu();
}

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
				self.registerHistory(self.chooseDate.bind(self));
				self.chooseTime();
			}
		}
	};

	var output = "What date do you want to schedule for? (M/D): ";

	this.sendMessage(output);
}

SchedulerConversation.prototype.chooseTime = function()
{
	var self = this;

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
				self.registerHistory(self.chooseTime.bind(self));
			}
		}
	};

	var output = "What time on " + this.state.event.start.format("dddd, MMM Do") + "? (H:MM): ";

	this.sendMessage(output);
}

SchedulerConversation.prototype.getServer = function(next)
{
	var self = this;
	var response = {};
	this.handler = function(message)
	{
		self.registerHistory(self.getServer.bind(self));
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
	this.busy();

	Promise.all([
		this.datastore.getTeamLocation(this.datastore.getPrimaryTeam().calendarId),
		this.datastore.getTeamLocation(this.state.event.calendarId)
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
			next = function(register)
			{
				if(register)
					self.registerHistory(self.chooseServer.bind(self));
				self.sendMessage("Creating scrim.");
				self.datastore.setEvent(self.state.event).then(function(event)
				{
					console.log("Event added");
					self.cancel();
				}, function(err)
				{
					console.log("Event failed: " + err + "\n" + self.state.event);
					self.cancel();
				});
			};
		}

		var options = [
			{ label: "New server.", action: function()
				{
					self.registerHistory(self.chooseServer.bind(self));
					self.getServer(function(location)
					{
						self.state.event.setLocation(location);
						if(self.state.event.id)
							self.history.pop();
						next();
					});
				}},
			{ label: "Skip for now.", action: function()
				{
					next(true);
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
					next(true);
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
					next(true);
				}
			});
		}

		self.makeMenu({
			label: "What server?",
			listOptions: options
		});
	});
}

SchedulerConversation.prototype.chooseEvent = function()
{
	var self = this;

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
					self.registerHistory(self.chooseEvent.bind(self));
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
			self.registerHistory(self.schedule.bind(self));
			self.chooseDate.bind(self);
		});
	}
	else
		this.chooseDate();
}

SchedulerConversation.prototype.update = function()
{
	var self = this;

	if(!this.state.event)
	{
		this.chooseEvent();
		return;
	}

	this.makeMenu({
		label: "What do you want to change?",
		listOptions: [
			{ label: "Date: " + this.state.event.start.format("dddd, MMM Do") + ".", action: function ()
				{
					self.registerHistory(self.update.bind(self));
					self.chooseDate();
				}},
			{ label: "Time: " + this.state.event.start.format("h:mm A") + ".", action: function ()
				{
					self.registerHistory(self.update.bind(self));
					self.chooseTime();
				}},
			{ label: "Location: " + this.state.event.location + ".", action: function ()
				{
					self.registerHistory(self.update.bind(self));
					self.chooseServer();
				}},
			{ label: "Save changes.", action: function ()
				{
					self.datastore.setEvent(self.state.event).then(function()
					{
						self.sendMessage("Scrim updated.");
						self.cancel();
					}, function(err)
					{
						console.log("Failed to save event: " + err);
						self.cancel();
					});
				}},
			{ label: "Cancel scrim.", action: function ()
				{
					self.datastore.cancelEvent(self.state.event).then(function()
					{
						self.sendMessage("Scrim cancelled.");
						self.cancel();
					}, function(err)
					{
						console.log("Failed to save event: " + err);
						self.cancel();
					});
				}}
		]
	});
}

module.exports = SchedulerConversation;