var fs = require("fs");
var path = require("path");
var util = require("util");

var Promise = require("promise");
var moment = require("moment");

var Calendar = require("./calendar.js");
var TeamData = require("./teamdata.js");

var resources = path.join(path.dirname(fs.realpathSync(__filename)), "../resources");

function Datastore ()
{
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

Datastore.prototype.createCalendar = function(name)
{
	return this.__calendar.createCalendar(name);
}

Datastore.prototype.deleteCalendar = function(calendarId)
{
	return this.__calendar.deleteCalendar(calendarId);
}

Datastore.prototype.getEvents = function(ids, min, max)
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
			return self.__calendar.getEvents(id, min, max);
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

Datastore.prototype.getFreeTimes = function(min, max)
{
	if(!min)
		min = moment();
	if(!max)
		max = moment(min).add(1, "day");
	var calendars = this.__teamdata.getTeamCalendars()
		.concat(this.__teamdata.getAvailabilityCalendar());
	return this.__calendar.getFreeTimes(calendars, min, max);
}

Datastore.prototype.getBusyTimes = function(min, max)
{
	if(!min)
		min = moment();
	if(!max)
		max = moment(min).add(1, "day");
	var calendars = this.__teamdata.getTeamCalendars()
		.concat(this.__teamdata.getAvailabilityCalendar());
	return this.__calendar.getBusyTimes(calendars, min, max);
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
	var self = this;
	return new Promise(function(resolve, reject)
	{
		self.createCalendar(name).then(function(calendarId)
		{
			resolve(self.__teamdata.createTeam({name: name, calendarId: calendarId}));
		}, reject);
	});
}

Datastore.prototype.deleteTeam = function(id)
{
	var self = this;
	return new Promise(function(resolve, reject)
	{
		self.deleteCalendar(id).then(function()
		{
			resolve(self.__teamdata.deleteTeam(id));
		}, reject);
	});
}

Datastore.prototype.getPrimaryTeam = function()
{
	return this.__teamdata.getPrimaryTeam();
}

Datastore.prototype.getTeam = function(id)
{
	return this.__teamdata.getTeam(id);
}

Datastore.prototype.getTeamLocation = function(id)
{
	var self = this;
	var team = this.__teamdata.getTeam(id);
	if(team.location === false)
	{
		return this.__calendar.getLocation(id).then(function(location)
		{
			team.location = location;
			return location;
		});
	}
	return Promise.resolve(team.location);
}

Datastore.prototype.setTeamLocation = function(id, location)
{
	var self = this;
	return this.__calendar.setLocation(id, location).then(function(location)
	{
		self.__teamdata.getTeam(id).location = location;
		return location;
	});
}

Datastore.prototype.saveTeamData = function()
{
	return this.__teamdata.save();
}

module.exports = Datastore;