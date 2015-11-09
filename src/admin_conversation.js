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
	var self = this;
	this.chooseTeam(function()
	{
		self.registerHistory(self.schedule.bind(self));
		self.chooseDate.bind(self);
	});
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

	this.makeMenu({
		label: "Which team do you want to "
			+ (remove
				? ("remove " + this.state.player.name + " from")
				: ("add " + this.state.player.name + " to"))
			+ " as "
			+ (asScheduler ? "scheduler" : "player")
			+ "?",
		listOptions: teams.map(function(team)
		{
			return { label: team.name, action: function()
			{
				if(remove)
					self.state.player.removeTeam(team, asScheduler);
				else
					self.state.player.addTeam(team, asScheduler);
				self.datastore.saveTeamData();
				self.back();
			}};
		})
	});
}

AdminConversation.prototype.choosePlayer = function()
{
	var self = this;
	var players = this.datastore.getPlayers();

	this.makeMenu({
		label: "Choose a player:",
		listOptions: players
			.map(function(player)
			{
				return { label: player.name, action: function()
				{
					self.registerHistory(self.choosePlayer.bind(self));
					self.state.player = player;
					self.modifyPlayer();
				}};
			}).concat({ label: "Create a new player", action: function()
				{
					self.registerHistory(self.choosePlayer.bind(self));
					self.createPlayer();
				}})
	});
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

	this.makeMenu({
		label: "What do you want to change about " + this.state.player.name +"?",
		listOptions: [
			{ label: "Add to team as player.", action: function ()
				{
					self.registerHistory(self.modifyPlayer.bind(self));
					self.modifyPlayerTeams(false, false);
				}},
			{ label: "Remove from team as player.", action: function ()
				{
					self.registerHistory(self.modifyPlayer.bind(self));
					self.modifyPlayerTeams(false, true);
				}},
			{ label: "Add to team as scheduler.", action: function ()
				{
					self.registerHistory(self.modifyPlayer.bind(self));
					self.modifyPlayerTeams(true, false);
				}},
			{ label: "Remove from team as scheduler.", action: function ()
				{
					self.registerHistory(self.modifyPlayer.bind(self));
					self.modifyPlayerTeams(true, true);
				}},
			{ label: (this.state.player.admin ? "Remove" : "Make") + " admin.", action: function ()
				{
					self.state.player.admin = !self.state.player.admin;
					self.datastore.saveTeamData();
					self.modifyPlayer();
				}},
			{ label: "Delete player.", action: function ()
				{
					self.datastore.deletePlayer(self.state.player.id);
					self.cancel();
				}}
		]
	});
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

	this.makeMenu({
		label: "Which "
			+ (asScheduler ? "scheduler" : "player")
			+ " do you want to "
			+ (remove ? "remove from " : "add to ")
			+ this.state.team.name + "?",
		listOptions: players.map(function(player)
		{
			return { label: player.name, action: function()
			{
				if(remove)
					player.removeTeam(self.state.team, asScheduler);
				else
					player.addTeam(self.state.team, asScheduler);
				self.datastore.saveTeamData();
				self.back();
			}};
		})
	});
}

AdminConversation.prototype.selectTeam = function()
{
	var self = this;

	var teams = this.datastore.getTeams();

	this.makeMenu({
		label: "Choose a team:",
		listOptions: teams
			.map(function(team)
			{
				return { label: team.name, action: function()
				{
					self.registerHistory(self.selectTeam.bind(self));
					self.state.team = team;
					self.modifyTeam();
				}};
			}).concat({ label: "Create a new team", action: function()
				{
					self.registerHistory(self.choosePlayer.bind(self));
					self.createTeam();
				}})
	});
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
			this.busy();
			this.datastore.getTeamLocation(this.state.team.calendarId).then(this.modifyTeam.bind(this));
			return;
		}
	}

	this.makeMenu({
		label: "What do you want to change about " + this.state.team.name +"?",
		listOptions: [
			{ label: "Change team name.", action: function ()
				{
					self.registerHistory(self.modifyTeam.bind(self));
					self.modifyTeamName();
				}},
			{ label: "Add player to team.", action: function ()
				{
					self.registerHistory(self.modifyTeam.bind(self));
					self.modifyTeamRoster(false, false);
				}},
			{ label: "Remove player from team.", action: function ()
				{
					self.registerHistory(self.modifyTeam.bind(self));
					self.modifyTeamRoster(false, true);
				}},
			{ label: "Add scheduler to team.", action: function ()
				{
					self.registerHistory(self.modifyTeam.bind(self));
					self.modifyTeamRoster(true, false);
				}},
			{ label: "Remove scheduler from team.", action: function ()
				{
					self.registerHistory(self.modifyTeam.bind(self));
					self.modifyTeamRoster(true, true);
				}},
			{ label: "Change team location. (" + this.state.team.location + ")", action: function ()
				{
					self.registerHistory(self.modifyTeam.bind(self));
					self.getServer(function(location)
					{
						self.history.pop();
						self.busy();
						self.datastore.setTeamLocation(self.state.team.calendarId, location)
							.then(self.modifyTeam.bind(this), function(err){console.log("error: " + err)});
					});
				}},
			{ label: "Delete team.", action: function ()
				{
					self.datastore.deleteTeam(self.state.team.calendarId).then(function()
					{
						self.cancel();
					}, function(err)
					{
						console.log("BAD STUFF " + err);
						self.cancel();
					});
				}}
		]
	});
}

module.exports = AdminConversation;