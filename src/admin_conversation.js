var util = require("util");

var moment = require("moment");

var Conversation = require("./conversation.js");
var Event = require("./calendar.js").Event;

function AdminConversation()
{
	var self = this;
	Conversation.apply(this, arguments);
	this.handler = this.mainmenu.bind(this);

	this.commands.cancel = function(){self.mainmenu()};
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
	this.datastore.getEvents().then(function(events)
	{
		var output = "Upcoming scrims:\n" + events.map(function(event)
		{
			return Conversation.friendlyEvent(event);
		}).join("\n");
		self.sendMessage(output);
		self.mainmenu();
	},
	function(err)
	{
		console.log(err);
	});
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

		var event = new Event({
			summary: "Scrim vs " + team.name,
			start:{
				dateTime: time.format()
			}
		});
		self.datastore.calendar.createEvent(event, team.calendarId).then(function(event)
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
		return counter++ + ": " + team.name;
	}).join("\n");
	this.sendMessage(output);
	
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