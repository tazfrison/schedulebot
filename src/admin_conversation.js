var util = require("util");

var moment = require("moment");

var SchedulerConversation = require("./scheduler_conversation.js");
var Event = require("./calendar.js").Event;

function AdminConversation()
{
	SchedulerConversation.apply(this, arguments);
	this.menuOptions = [
		{label: "List currently scheduled scrims.", action: this.listScrims.bind(this)},
		{label: "Schedule a new scrim.", action: this.schedule.bind(this)},
		{label: "Modify an existing scrim.", action: this.update.bind(this)}
	];
}

util.inherits(AdminConversation, SchedulerConversation);

AdminConversation.prototype.getEvents = function()
{
	return this.datastore.getEvents();
}

AdminConversation.prototype.chooseTeam = function(nextState)
{
	var self = this;

	var teams = this.datastore.teamdata.teams.slice();
	this.handler = function(message)
	{
		var input = message * 1;
		if(!isNaN(input) && input > 0 && input <= teams.length)
		{
			self.state.team = teams[input - 1];
			self.state.event = new Event(self.state.team.calendarId);
			self.state.event.setSummary("Scrim vs " + self.state.team.name);
			nextState();
		}
		else
		{
			self.sendMessage(input + " is invalid.  " + output);
		}
	};

	var counter = 1;
	var output = "What team is this scrim against?\n";

	output += teams.map(function(team)
	{
		return "\t" + counter++ + ": " + team.name;
	}).join("\n");
	this.sendMessage(output);
}

AdminConversation.prototype.chooseDate = function()
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
				self.update();
			else
				self.chooseTime();
		}
	};

	var output = "What date do you want to schedule for? (M/D): ";

	this.sendMessage(output);
}

AdminConversation.prototype.chooseTime = function()
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
				self.update();
			else
				self.chooseServer();
		}
	};

	var output = "What time on " + this.state.event.start.format("dddd, MMM Do") + "? (H:MM): ";

	this.sendMessage(output);
}

AdminConversation.prototype.chooseServer = function()
{
	var self = this;

	this.handler = function(message)
	{
		switch(message.charAt(0))
		{
			case "1":
				break;
			case "2":
				break;
			case "3":
				break;
			case "4":
				break;
			default:
				break;
		}

		self.state.event.setLocation("");

		if(self.state.event.id)
		{
			self.update();
		}
		else
		{
			self.message("Creating scrim.");
			self.datastore.setEvent(self.state.event).then(function(event)
			{
				console.log("Event added");
				delete self.state.event;
				self.mainmenu();
			}, function(err)
			{
				console.log("Event failed: " + err + "\n" + self.state.event);
				delete self.state.event;
				self.mainmenu();
			});
		}
	};

	var output = "What server?\n\
	1: Ours ()\n\
	2: Yours ()\n\
	3: Other\n\
	4: Skip for now";

	this.sendMessage(output);
}

AdminConversation.prototype.chooseEvent = function()
{
	var self = this;

	this.getEvents().then(function(events)
	{
		var counter = 1;

		self.handler = function(message)
		{
			var input = message * 1;
			if(!isNaN(input) && input > 0 && input <= events.length)
			{
				self.state.event = events[input - 1];
				self.update();
			}
			else
			{
				self.sendMessage(input + " is invalid.  " + output);
			}
		};

		var output = "Choose an upcoming scrim:\n" + events.map(function(event)
		{
			return "\t" + counter++ + ": " + self.friendlyEvent(event);
		}).join("\n");

		self.sendMessage(output);
	},function(err)
	{
		console.log(err);
	});
}

AdminConversation.prototype.schedule = function()
{
	this.chooseTeam(this.chooseDate.bind(this));
}

AdminConversation.prototype.update = function()
{
	var self = this;

	if(!this.state.event)
	{
		this.chooseEvent();
		return;
	}

	this.handler = function(message)
	{
		switch(message)
		{
			case "1":
				self.chooseDate();
				break;
			case "2":
				self.chooseTime();
				break;
			case "3":
				self.chooseLocation();
				break;
			case "4":
				save();
				break;
			case "5":
				cancel();
				break;
			default:
				self.sendMessage(message + " is invalid.  " + output);
				break;
		}
	}

	var save = function()
	{
		self.datastore.setEvent(self.state.event).then(function()
		{
			self.message("Scrim updated.");
			delete self.state.event;
			self.mainmenu();
		}, function(err)
		{
			console.log("Failed to save event: " + err);
			delete self.state.event;
			self.mainmenu();
		});
	}

	var cancel = function()
	{
		self.datastore.cancelEvent(self.state.event).then(function()
		{
			self.message("Scrim cancelled.");
			delete self.state.event;
			self.mainmenu();
		}, function(err)
		{
			console.log("Failed to save event: " + err);
			delete self.state.event;
			self.mainmenu();
		});
	}

	var output = "What do you want to change?\n\
	1: Date: " + this.state.event.start.format("dddd, MMM Do") + "\n\
	2: Time: " + this.state.event.start.format("h:mm A") + "\n\
	3: Location: " + this.state.event.location + "\n\
	4: Save changes\n\
	5: Cancel scrim";

	this.sendMessage(output);
}

module.exports = AdminConversation;