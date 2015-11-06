var fs = require("fs");
var path = require("path");
var util = require("util");

var Promise = require("promise");

var Calendar = require("./calendar.js");
var TeamData = require("./teamdata.js");

var resources = path.join(path.dirname(fs.realpathSync(__filename)), "../resources");
var logs = path.join(resources, "logs");

function Datastore ()
{
	this.logfiles = {};
	this.__teamdata = new TeamData();
	this.__calendar = new Calendar();
}

Datastore.prototype.init = function()
{
	return Promise.all([this.__teamdata.init(), this.__calendar.init()]);
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
		ids = this.__teamdata.getTeamCalendars();
	}
	return new Promise(function(resolve, reject)
	{
		Promise.all(ids.map(function(id)
		{
			return self.__calendar.getEvents(id);
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
		return this.__calendar.modifyEvent(event, event.calendarId);
	else
		return this.__calendar.createEvent(event, event.calendarId);
}

Datastore.prototype.cancelEvent = function(event)
{
	return this.__calendar.deleteEvent(event, event.calendarId);
}

/* **********************************
        TEAMDATA MODIFICATIONS
********************************** */

Datastore.prototype.getPlayer = function(id)
{
	return this.__teamdata.getPlayer(id);
}

Datastore.prototype.getPlayers = function()
{
	return this.__teamdata.getPlayers();
}

Datastore.prototype.getPrimaryPlayers = function()
{
	return this.__teamdata.getPrimaryPlayers();
}

Datastore.prototype.createPlayer = function(id)
{
	return this.__teamdata.createPlayer(id);
}

Datastore.prototype.deletePlayer = function(id)
{
	return this.__teamdata.deletePlayer(id);
}

Datastore.prototype.getTeams = function()
{
	return this.__teamdata.getTeams();
}

Datastore.prototype.createTeam = function(name)
{
	return this.__teamdata.createTeam(name);
}

Datastore.prototype.deleteTeam = function(team)
{
	return this._teamdata.deleteTeam(name);
}

Datastore.prototype.saveTeamData = function()
{
	return this.__teamdata.save();
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

module.exports = Datastore;