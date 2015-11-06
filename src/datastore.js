var fs = require("fs");
var path = require("path");
var util = require("util");

var Promise = require("promise");

var Calendar = require("./calendar.js");

var resources = path.join(path.dirname(fs.realpathSync(__filename)), "../resources");
var logs = path.join(resources, "logs");

function Datastore ()
{
	this.logfiles = {};
	this.teamdata = new TeamData();
	this.calendar = new Calendar();
}

Datastore.prototype.init = function()
{
	return Promise.all([this.teamdata.init(), this.calendar.init()]);
}

Datastore.prototype.getSteamLogin = function()
{
	var confPath = path.join(resources, "login.conf");
	try
	{
		fs.accessSync(confPath, fs.R_OK);
		return JSON.parse(fs.readFileSync(confPath));
	}
	catch(e)
	{
		return false;
	}
}

Datastore.prototype.getServers = function()
{
	var confPath = path.join(resources, "servers");
	try
	{
		fs.accessSync(confPath, fs.R_OK, fs.W_OK);
		return JSON.parse(fs.readFileSync(confPath));
	}
	catch(e)
	{
		return false;
	}
}

Datastore.prototype.setServers = function(serverFile)
{
	var confPath = path.join(resources, "servers");
	fs.writeFile(confPath, JSON.stringify(serverFile));
}

Datastore.prototype.getSentry = function(username)
{
	var sentryPath = path.join(resources, "bot." + username + ".sentry");
	return false;
}

Datastore.prototype.setSentry = function(username, sentry)
{
	var sentryPath = path.join(resources, "bot." + username + ".sentry");
	fs.writeFileSync(sentryPath, sentry);
}

/* **********************************
        CALENDAR MODIFICATIONS
********************************** */

Datastore.prototype.getEvents = function(ids)
{
	var self = this;
	if(!ids || !util.isArray(ids) || ids.length === 0)
	{
		//Get all events
		ids = this.teamdata.teams.map(function(team)
		{
			return team.calendarId;
		});
	}
	return new Promise(function(resolve, reject)
	{
		Promise.all(ids.map(function(id)
		{
			return self.calendar.getEvents(id);
		})).then(function(eventsArr)
		{
			resolve([].concat.apply([], eventsArr).sort(function(a, b)
				{
					if(a.start.isBefore(b.start))
						return -1;
					else if(a.start.isSame(b.start))
						return 0;
					else
						return 1;
				}));
		}, reject);
	});
}

Datastore.prototype.setEvent = function(event)
{
	if(event.id)
		return this.calendar.modifyEvent(event, event.calendarId);
	else
		return this.calendar.createEvent(event, event.calendarId);
}

Datastore.prototype.cancelEvent = function(event)
{
	return this.calendar.deleteEvent(event, event.calendarId);
}

/* **********************************
        TEAMDATA MODIFICATIONS
********************************** */

Datastore.prototype.getPlayer = function(id)
{
	return this.teamdata.getPlayer(id);
}

Datastore.prototype.getPlayers = function()
{
	var players = [];
	for(var id in this.teamdata.players)
		players.push(this.teamdata.players[id]);
	return players;
}

Datastore.prototype.getPrimaryPlayers = function()
{
	return this.teamdata.getOwnPlayers();
}

Datastore.prototype.createPlayer = function(id)
{
	var player = this.teamdata.players[id] = new TeamData.Player(id, {name: ""});
	this.teamdata.save();
	return player;
}

Datastore.prototype.deletePlayer = function(id)
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
	delete this.teamdata.players[id];
	this.teamdata.save();
}

Datastore.prototype.getTeams = function()
{
	return this.teamdata.teams.slice();
}

Datastore.prototype.createTeam = function(name)
{
	var team = this.teamdata.teams.push(new TeamData.Team({name: name}, []));
	this.teamdata.save();
	return team;
}

Datastore.prototype.deleteTeam = function(team)
{
	team.players.forEach(function(team)
	{
		player.playsOn.splice(player.playsOn.indexOf(team), 1);
	});
	team.schedulers.forEach(function(team)
	{
		player.scheduleFor.splice(player.scheduleFor.indexOf(player), 1);
	});
	this.teamdata.teams.splice(this.teamdata.teams.indexOf(team));
	this.teamdata.save();
}

/* **********************************
             CHAT LOGGING
********************************** */

Datastore.prototype.getLog = function(id)
{
	if(!this.logfiles[id])
		this.logfiles[id] = new Log(id);
	return this.logfiles[id];
}

function Log(id)
{
	this.path = path.join(logs, id + ".log");

}

function getTimeString()
{
	var timestamp = new Date();
	var temp;
	var output = "";

	temp = timestamp.getUTCSeconds();
	output = temp;
	if(temp < 10)
		output = "0" + output;

	temp = timestamp.getUTCMinutes();
	output = temp + ":" + output;
	if(temp < 10)
		output = "0" + output;

	temp = timestamp.getUTCHours();
	if(temp >= 12)
	{
		temp -= 12;
		output += " PM";
	}
	else
		output += " AM";
	if(temp === 0)
		temp = 12;
	output = temp + ":" + output;
	if(temp < 10)
		output = "0" + output;

	return output;
}

Log.prototype.write = function(name, message)
{
	var output = "[" + getTimeString() + "] " + name + ": " + message + "\n";

	fs.appendFile(this.path, output);
}

function TeamData()
{
	this.teams = [];
	this.players = {};
	this.admins = [];
	this.ownTeam;
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
			self.ownTeam = self.teams[self.teams.length - 1];
	});
	return Promise.resolve(true);
}

TeamData.prototype.getPlayer = function(id)
{
	return this.players[id] || false;
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

TeamData.prototype.getOwnPlayers = function()
{
	return this.ownTeam.roster.slice();
}

TeamData.prototype.isAdmin = function(id)
{
	return this.admins.indexOf(this.players[id]) > -1;
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
			self.ownTeam = self.teams[self.teams.length - 1];
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

module.exports = Datastore;