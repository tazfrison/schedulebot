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

AdminConversation.prototype.schedule = function()
{
	var self = this;
	var teams = this.datastore.teamdata.teams.slice();
	var team;
	var date;
	var time;

	var getDate = function(message)
	{
		var input = message * 1;
		if(!isNaN(input) && input > 0 && input <= teams.length)
		{
			team = teams[input - 1];
			self.handler = getTime;
			self.sendMessage("What date do you want to schedule for? (M/D): ");
		}
		else
		{
			self.sendMessage(input + " is invalid.  " + output);
		}
	};

	var getTime = function(message)
	{
		date = message;
		self.handler = chooseServer;
		self.sendMessage("What time on " + moment(date, "M/D").format("dddd, MMM Do") + "? (H:MM): ");
	};
	var chooseServer = function(message)
	{
		time = moment(date + "T" + message, "M/D H:mm");
		self.handler = getServer;
		self.sendMessage("What server?\n\
	1: Ours ()\n\
	2: Yours ()\n\
	3: Other\n\
	4: Skip for now");
	};
	var getServer = function(message)
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

		var event = new Event(team.calendarId,
		{
			summary: "Scrim vs " + team.name,
			start:{
				dateTime: time.format()
			}
		});
		self.datastore.setEvent(event).then(function(event)
		{
			console.log("Event added");
			self.mainmenu();
		}, function(err)
		{
			console.log("Event failed: " + err + "\n" + event);
			self.mainmenu();
		});
	};

	this.handler = getDate;
	var counter = 1;
	var output = "What team is this scrim against?\n";

	output += teams.map(function(team)
	{
		return "\t" + counter++ + ": " + team.name;
	}).join("\n");
	this.sendMessage(output);
}

AdminConversation.prototype.update = function()
{
	var self = this;
	var event;
	var output;

	var whatChange = function(message)
	{
		switch(message)
		{
			case "1":
				self.handler = whatDate;
				self.sendMessage("What date do you want to reschedule to? (M/D): ");
				break;
			case "2":
				self.handler = whatTime;
				self.sendMessage("What time do you want to reschedule for? (H:MM): ");
				break;
			case "3":
				self.handler = whatLocation;
				self.sendMessage("What server?\n\
	1: Ours ()\n\
	2: Yours ()\n\
	3: Other\n\
	4: Skip for now");
				break;
			case "4":
				cancel()
				break;
			default:
				self.sendMessage(input + " is invalid.  " + output);
				break;
		}
	}

	var whatDate = function(message)
	{
		var date = moment(message, "M/D");
		event.start.set({"month": date.month(), "day": date.day()});
		self.datastore.setEvent(event).then(function(event)
		{
			console.log("Event date changed");
			self.mainmenu();
		}, function(err)
		{
			console.log("Event failed: " + err + "\n" + event);
			self.mainmenu();
		});
	}

	var whatTime = function(message)
	{
		var time = moment(message, "H:mm");
		event.start.set({"hour": time.hour(), "minute": time.minute()});
		self.datastore.setEvent(event).then(function(event)
		{
			console.log("Event time changed");
			self.mainmenu();
		}, function(err)
		{
			console.log("Event failed: " + err + "\n" + event);
			self.mainmenu();
		});
	}

	var whatLocation = function(message)
	{
		self.handler = getServer;
		self.sendMessage("What server?\n\
	1: Ours ()\n\
	2: Yours ()\n\
	3: Other\n\
	4: Skip for now");
	}

	var getServer = function(message)
	{
		event.location = message;
		self.datastore.setEvent(event).then(function(event)
		{
			console.log("Event location changed");
			self.mainmenu();
		}, function(err)
		{
			console.log("Event failed: " + err + "\n" + event);
			self.mainmenu();
		});
	}

	var cancel = function()
	{
		self.datastore.cancelEvent(event);
	}

	this.datastore.getEvents().then(function(events)
	{
		var counter = 1;

		self.handler = function(message)
		{
			var input = message * 1;
			if(!isNaN(input) && input > 0 && input <= events.length)
			{
				event = events[input - 1];
				self.handler = whatChange;
				output = "What do you want to change?\n\
	1: Date: " + event.start.format("dddd, MMM Do") + "\n\
	2: Time: " + event.start.format("h:mm A") + "\n\
	3: Location: " + event.location + "\n\
	4: Cancel scrim";
				self.sendMessage(output);
			}
			else
			{
				self.sendMessage(input + " is invalid.  " + output);
			}
		};

		output = "Choose an upcoming scrim:\n" + events.map(function(event)
		{
			return "\t" + counter++ + ": " + Conversation.friendlyEvent(event);
		}).join("\n");
		self.sendMessage(output);
	},function(err)
	{
		console.log(err);
	});
}

module.exports = AdminConversation;