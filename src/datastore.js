var fs = require("fs");
var path = require("path");
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

TeamData.prototype.getOwnPlayers = function()
{
	return this.ownTeam.roster;
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
		players: this.players,
		teams: this.teams
	}

	return JSON.stringify(output);
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
		players[id].addAsPlayer(self);
	});
	data.schedulers.forEach(function(id)
	{
		players[id].addAsScheduler(self);
	});
}

TeamData.Team.prototype.toString = function()
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

	return JSON.stringify(output);
}

TeamData.Player = function(id, data)
{
	this.name = data.name;
	this.id = id;
	this.admin = data.admin || false;
	this.playsOn = [];
	this.schedulesFor = [];
}

TeamData.Player.prototype.addAsPlayer = function(team)
{
	this.playsOn.push(team);
	team.roster.push(this);
}

TeamData.Player.prototype.addAsScheduler = function(team)
{
	this.schedulesFor.push(team);
	team.schedulers.push(this);
}

TeamData.Player.prototype.toString = function()
{
	var output = {
		name: this.name
	};
	if(this.admin)
		output.admin = true;

	return JSON.stringify(output);
}

module.exports = Datastore;