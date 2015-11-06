var fs = require("fs");
var path = require("path");

var Promise = require("promise");

var resources = path.join(path.dirname(fs.realpathSync(__filename)), "../resources");

function TeamData()
{
	this.teams = [];
	this.players = {};
	this.admins = [];
	this.primaryTeam;
}

TeamData.prototype.init = function()
{
	var self = this;

	var confPath = path.join(resources, "data.conf");
	var data;
	var keys;
	try
	{
		fs.accessSync(confPath, fs.R_OK, fs.W_OK);
		data = JSON.parse(fs.readFileSync(confPath));
	}
	catch(e)
	{
		return Promise.reject(false);
	}
	keys = Object.keys(data.players);
	keys.forEach(function(key)
	{
		self.players[key] = new TeamData.Player(key, data.players[key]);
		if(self.players[key].admin)
			self.admins.push(self.players[key]);
	});

	data.teams.forEach(function(team)
	{
		self.teams.push(new TeamData.Team(team, self.players));
		if(team.primary)
			self.primaryTeam = self.teams[self.teams.length - 1];
	});
	return Promise.resolve(true);
}

TeamData.prototype.load = function()
{
	var self = this;

	var confPath = path.join(resources, "data.conf");
	var data;
	var keys;
	try
	{
		fs.accessSync(confPath, fs.R_OK, fs.W_OK);
		data = JSON.parse(fs.readFileSync(confPath));
	}
	catch(e)
	{
		return false;
	}
	keys = Object.keys(data.players);
	keys.forEach(function(key)
	{
		self.players[key] = new TeamData.Player(key, data.players[key]);
		if(self.players[key].admin)
			self.admins.push(self.players[key]);
	});

	data.teams.forEach(function(team)
	{
		self.teams.push(new TeamData.Team(team, self.players));
		if(team.primary)
			self.primaryTeam = self.teams[self.teams.length - 1];
	});
}

TeamData.prototype.save = function()
{
	var data = this.toString();
	var confPath = path.join(resources, "data.conf");
	fs.writeFile(confPath, data);
}

TeamData.prototype.toString = function()
{
	var output = {
		players: {},
		teams: this.teams.map(function(team)
		{
			return team.flatten();
		})
	};

	for(var player in this.players)
	{
		output.players[player] = this.players[player].flatten();
	}

	return JSON.stringify(output, null, 4);
}

/* **************************
			PLAYER
************************** */

TeamData.prototype.createPlayer = function(id)
{
	var player = this.players[id] = new TeamData.Player(id, {name: ""});
	this.save();
	return player;
}

TeamData.prototype.deletePlayer = function(id)
{
	var player = this.getPlayer(id);
	player.playsOn.forEach(function(team)
	{
		team.players.splice(team.players.indexOf(player), 1);
	});
	player.scheduleFor.forEach(function(team)
	{
		team.schedulers.splice(team.schedulers.indexOf(player), 1);
	});
	delete this.players[id];
	this.save();
}

TeamData.prototype.getPlayer = function(id)
{
	return this.players[id] || false;
}

TeamData.prototype.getPlayers = function()
{
	var players = [];
	for(var id in this.players)
		players.push(this.players[id]);
	return players;
}

TeamData.prototype.updatePlayerName = function(id, name)
{
	if(this.players[id])
	{
		console.log("Updating " + this.players[id].name
			+ "'s name to " + name);
		this.players[id].name = name;
		this.save();
	}
}

TeamData.prototype.getPrimaryPlayers = function()
{
	return this.primaryTeam.roster.slice();
}

TeamData.prototype.isAdmin = function(id)
{
	return this.admins.indexOf(this.players[id]) > -1;
}

/* **************************
			TEAM
************************** */

TeamData.prototype.createTeam = function(name)
{
	var team = this.teams.push(new TeamData.Team({name: name}, []));
	this.save();
	return team;
}

TeamData.prototype.deleteTeam = function(id)
{
	team.players.forEach(function(team)
	{
		player.playsOn.splice(player.playsOn.indexOf(team), 1);
	});
	team.schedulers.forEach(function(team)
	{
		player.scheduleFor.splice(player.scheduleFor.indexOf(player), 1);
	});
	this.teams.splice(this.teams.indexOf(team));
	this.save();
}

TeamData.prototype.getTeams = function()
{
	return this.teams.slice();
}

TeamData.prototype.getTeamCalendars = function()
{
	return this.teams.map(function(team)
	{
		return team.calendarId;
	});
}

/* **************************
		HELPER CLASSES
************************** */

TeamData.Team = function(data, players)
{
	var self = this;

	this.name = data.name;
	this.primary = data.primary || false;
	this.calendarId = data.calendarId;
	this.roster = [];
	this.schedulers = [];

	data.roster.forEach(function(id)
	{
		players[id].addTeam(self);
	});
	data.schedulers.forEach(function(id)
	{
		players[id].addTeam(self, true);
	});
}

TeamData.Team.prototype.flatten = function()
{
	var output = {
		name: this.name,
		calendarId: this.calendarId,
		roster: [],
		schedulers: []
	};
	if(this.primary)
		output.primary = true;
	this.roster.forEach(function(player)
	{
		output.roster.push(player.id);
	});
	this.schedulers.forEach(function(player)
	{
		output.schedulers.push(player.id);
	});

	return output;
}

TeamData.Team.prototype.toString = function()
{
	return JSON.stringify(this.flatten());
}

TeamData.Player = function(id, data)
{
	this.name = data.name;
	this.id = id;
	this.admin = data.admin || false;
	this.playsOn = [];
	this.schedulesFor = [];
}

TeamData.Player.prototype.addTeam = function(team, asScheduler)
{
	if(asScheduler)
	{
		this.schedulesFor.push(team);
		team.schedulers.push(this);
	}
	else
	{
		this.playsOn.push(team);
		team.roster.push(this);
	}
}

TeamData.Player.prototype.removeTeam = function(team, asScheduler)
{
	if(asScheduler)
	{
		this.schedulesFor.splice(this.schedulesFor.indexOf(team), 1);
		team.schedulers.splice(team.schedulers.indexOf(this), 1);
	}
	else
	{
		this.playsOn.splice(this.playsOn.indexOf(team), 1);
		team.roster.splice(team.roster.indexOf(this), 1);
	}
}

TeamData.Player.prototype.flatten = function()
{
	var output = {
		name: this.name
	};
	if(this.admin)
		output.admin = true;

	return output;
}

TeamData.Player.prototype.toString = function()
{
	return JSON.stringify(this.flatten());
}

module.exports = TeamData;