var util = require("util");

var moment = require("moment");

var SchedulerConversation = require("./scheduler_conversation.js");
var Event = require("./calendar.js").Event;

function AdminConversation()
{
	SchedulerConversation.apply(this, arguments);
	this.menuOptions = this.menuOptions.concat([
		{label: "Modify player data.", action: this.modifyPlayer.bind(this)},
		{label: "Modify team data.", action: this.modifyTeam.bind(this)}
	]);
}

util.inherits(AdminConversation, SchedulerConversation);

AdminConversation.prototype.cancel = function()
{
	delete this.state.player;
	delete this.state.team;
	AdminConversation.super_.prototype.cancel.call(this);
}

AdminConversation.prototype.getEvents = function()
{
	return this.datastore.getEvents();
}

AdminConversation.prototype.getTeams = function()
{
	return this.datastore.getTeams().filter(function(team)
		{
			return !team.primary;
		});
}

AdminConversation.prototype.schedule = function()
{
	this.chooseTeam(this.chooseDate.bind(this));
}

AdminConversation.prototype.modifyPlayerTeams = function(asScheduler, remove)
{
	var self = this;

	var teams = [];
	var filter;
	if(remove)
	{
		if(asScheduler)
			teams = this.state.player.schedulesFor;
		else
			teams = this.state.player.playsOn;
	}
	else
	{
		teams = this.datastore.getTeams();
		if(asScheduler)
		{
			teams = teams.filter(function(team)
			{
				return self.state.player.schedulesFor.indexOf(team) === -1;
			});
		}
		else
		{
			teams = teams.filter(function(team)
			{
				return self.state.player.playsOn.indexOf(team) === -1;
			});
		}
	}
	this.handler = function(message)
	{
		var input = message * 1 - 1;
		if(!isNaN(input) && input >= 0 && input < teams.length)
		{
			if(remove)
				self.state.player.removeTeam(teams[input], asScheduler);
			else
				self.state.player.addTeam(teams[input], asScheduler);
			self.datastore.saveTeamData();
			self.modifyPlayer();
		}
		else
		{
			self.sendMessage(input + " is invalid.  " + output);
		}
	};

	var counter = 1;
	var output = "Which team do you want to "
		+ (remove
			? ("remove " + this.state.player.name + " from")
			: ("add " + this.state.player.name + " to"))
		+ " as "
		+ (asScheduler ? "scheduler" : "player")
		+ "?\n";

	output += teams.map(function(team)
	{
		return "\t" + counter++ + ": " + team.name;
	}).join("\n");
	this.sendMessage(output);
}

AdminConversation.prototype.choosePlayer = function()
{
	var self = this;
	var players = this.datastore.getPlayers();


	var counter = 1;

	this.handler = function(message)
	{
		var input = message * 1 - 1;
		if(!isNaN(input) && input >= 0 && input <= players.length)
		{
			if(input === players.length)
			{
				self.createPlayer();
				return;
			}
			self.state.player = players[input];
			self.modifyPlayer();
		}
		else
		{
			self.sendMessage(input + " is invalid.  " + output);
		}
	};

	var output = "Choose a player:\n\t" + players
		.map(function(player)
		{
			return counter++ + ": " + player.name;
		}).concat(counter + ": Create a new player").join("\n\t");

	this.sendMessage(output);
}

AdminConversation.prototype.createPlayer = function()
{
	var self = this;

	this.handler = function(message)
	{
		self.datastore.createPlayer(message);
		self.state.player = self.datastore.getPlayer(message);
		self.modifyPlayer();
	};

	var output = "What is the steam ID of this player?: ";

	this.sendMessage(output);
}

AdminConversation.prototype.modifyPlayer = function()
{
	var self = this;

	if(!this.state.player)
	{
		this.choosePlayer();
		return;
	}

	this.handler = function(message)
	{
		switch(message)
		{
			case "1":
				self.modifyPlayerTeams(false, false);
				break;
			case "2":
				self.modifyPlayerTeams(false, true);
				break;
			case "3":
				self.modifyPlayerTeams(true, false);
				break;
			case "4":
				self.modifyPlayerTeams(true, true);
				break;
			case "5":
				toggleAdmin();
				break;
			case "6":
				deletePlayer();
				break;
			default:
				self.sendMessage(message + " is invalid.  " + util.format(output,
					self.state.player.name,
					(self.state.player.admin ? "Remove" : "Make")));
							break;
		}
	}

	var toggleAdmin = function()
	{
		self.state.player.admin = !self.state.player.admin;

		self.datastore.saveTeamData();

		self.sendMessage(util.format(output,
			self.state.player.name,
			(self.state.player.admin ? "Remove" : "Make")));
	}

	var deletePlayer = function()
	{
		self.datastore.deletePlayer(self.state.player.id);
		self.cancel();
	}

	var output = "What do you want to change about %s?\n\
	1: Add to team as player.\n\
	2: Remove from team as player.\n\
	3: Add to team as scheduler.\n\
	4: Remove from team as scheduler.\n\
	5: %s admin.\n\
	6: Remove player.";


	this.sendMessage(util.format(output,
		this.state.player.name,
		(this.state.player.admin ? "Remove" : "Make")));
}

/* **********************************
		MODIFY TEAMS
********************************** */

AdminConversation.prototype.modifyTeamRoster = function(asScheduler, remove)
{
	var self = this;

	var players = [];
	var filter;
	if(remove)
	{
		if(asScheduler)
			players = this.state.team.schedulers;
		else
			players = this.state.team.roster;
	}
	else
	{
		players = this.datastore.getPlayers();
		if(asScheduler)
		{
			players = players.filter(function(player)
			{
				return self.state.team.schedulers.indexOf(player) === -1;
			});
		}
		else
		{
			players = players.filter(function(player)
			{
				return self.state.team.roster.indexOf(player) === -1;
			});
		}
	}
	this.handler = function(message)
	{
		var input = message * 1 - 1;
		if(!isNaN(input) && input >= 0 && input < players.length)
		{
			if(remove)
				self.datastore.getPlayer(players[input].id).removeTeam(self.state.team, asScheduler);
			else
				self.datastore.getPlayer(players[input].id).addTeam(self.state.team, asScheduler);
			self.datastore.saveTeamData();
			self.modifyTeam();
		}
		else
		{
			self.sendMessage(input + " is invalid.  " + output);
		}
	};

	var counter = 1;
	var output = "Which "
		+ (asScheduler ? "scheduler" : "player")
		+ " do you want to "
		+ (remove
			? ("remove from " + this.state.team.name)
			: ("add to " + this.state.team.name))
		+ "?\n";

	output += players.map(function(player)
	{
		return "\t" + counter++ + ": " + player.name;
	}).join("\n");
	this.sendMessage(output);
}

AdminConversation.prototype.selectTeam = function()
{
	var self = this;

	var counter = 1;

	var teams = this.datastore.getTeams();

	this.handler = function(message)
	{
		var input = message * 1 - 1;
		if(!isNaN(input) && input >= 0 && input <= teams.length)
		{
			if(input === teams.length)
			{
				self.createTeam();
				return;
			}
			self.state.team = teams[input];
			self.modifyTeam();
		}
		else
		{
			self.sendMessage(input + " is invalid.  " + output);
		}
	};

	var output = "Choose a team:\n\t" + teams
		.map(function(team)
		{
			return counter++ + ": " + team.name;
		}).concat(counter + ": Create a new team").join("\n\t");

	this.sendMessage(output);
}

AdminConversation.prototype.createTeam = function()
{
	var self = this;

	this.handler = function(message)
	{
		self.datastore.createTeam(message).then(function(team)
		{
			self.state.team = team;
			self.modifyTeam();
		}, function(err)
		{
			console.log("BAD STUFF " + err);
		});
	};

	var output = "What is the team name?: ";

	this.sendMessage(output);
}

AdminConversation.prototype.modifyTeam = function()
{
	var self = this;

	if(!this.state.team)
	{
		this.selectTeam();
		return;
	}
	else
	{
		if(this.state.team.location === false)
		{
			this.handler = this.busy.bind(this);
			this.datastore.getTeamLocation(this.state.team.calendarId).then(this.modifyTeam.bind(this));
			return;
		}
	}

	this.handler = function(message)
	{
		switch(message)
		{
			case "1":
				self.modifyTeamName();
				break;
			case "2":
				self.modifyTeamRoster(false, false);
				break;
			case "3":
				self.modifyTeamRoster(false, true);
				break;
			case "4":
				self.modifyTeamRoster(true, false);
				break;
			case "5":
				self.modifyTeamRoster(true, true);
				break;
			case "6":
				self.getServer(function(location)
				{
					self.handler = self.busy.bind(self);
					self.datastore.setTeamLocation(self.state.team.calendarId, location)
						.then(self.modifyTeam.bind(this), function(err){console.log("error: " + err)});
				});
				break;
			case "7":
				deleteTeam();
				break;
			default:
				self.sendMessage(message + " is invalid.  "
					+ util.format(output, self.state.team.name, self.state.team.location));
				break;
		}
	}

	var deleteTeam = function()
	{
		self.datastore.deleteTeam(self.state.team.calendarId).then(function()
		{
			self.cancel();
		}, function(err)
		{
			console.log("BAD STUFF " + err);
			self.cancel();
		});
	}

	var output = "What do you want to change about %s?\n\
	1: Change team name.\n\
	2: Add player to team.\n\
	3: Remove player from team.\n\
	4: Add scheduler to team.\n\
	5: Remove scheduler from team.\n\
	6: Change team location ( %s ).\n\
	7: Delete team.";

	this.sendMessage(util.format(output, this.state.team.name, this.state.team.location));
}

module.exports = AdminConversation;