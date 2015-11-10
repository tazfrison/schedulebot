var fs = require("fs");
var path = require("path");
var readline = require("readline");
var util = require("util");

var moment = require("moment");
var Promise = require("promise");
var google = require("googleapis");
var googleAuth = require("google-auth-library");

var SCOPES = ["https://www.googleapis.com/auth/calendar"];
var TOKEN_DIR = path.join(path.dirname(fs.realpathSync(__filename)), "../resources/.credentials/");
var TOKEN_PATH = path.join(TOKEN_DIR, "calendar-nodejs-schedulebot.json");

var CLIENT_AUTH = path.join(TOKEN_DIR, "client_secret.json");

var EVENT_LENGTH = {minutes: 30};

function Calendar()
{
	this.calendar = google.calendar("v3");
}

Calendar.prototype.init = function()
{
	var self = this;
	return new Promise(function(resolve, reject)
	{
		fs.readFile(CLIENT_AUTH, function(err, content)
		{
			if(err)
			{
				console.log("Error loading client secret file: " + err);
				reject(err);
				return;
			}

			authorize(JSON.parse(content), function(auth)
				{
					self.auth = auth;
					resolve(true);
				});
		});
	});
}

Calendar.prototype.createCalendar = function(name)
{
	var self = this;
	return new Promise(function(resolve, reject)
	{
		if(!name)
		{
			reject("No name provided.");
			return;
		}
		self.calendar.calendars.insert({
			auth: self.auth,
			resource: {
				summary: name
			}
		}, function(err, response)
		{
			if(err)
			{
				reject(err);
				return;
			}
			resolve(response.id);
		})
	});
}

Calendar.prototype.deleteCalendar = function(calendarId)
{
	var self = this;
	return new Promise(function(resolve, reject)
	{
		if(!calendarId)
		{
			reject("No calendar id provided.");
			return;
		}
		self.calendar.calendars.delete({
			auth: self.auth,
			calendarId: calendarId
		}, function(err, response)
		{
			if(err)
			{
				reject(err);
				return;
			}
			resolve();
		})
	});
}

Calendar.prototype.getCalendars = function()
{
	var self = this;
	return new Promise(function(resolve, reject)
	{
		self.calendar.calendarList.list({
			auth: self.auth
		}, function(err, response)
		{
			if(err)
			{
				reject(err);
				return;
			}
			resolve(response.items);
		});
	});
}

Calendar.prototype.getBusyTimes = function(ids, min, max)
{
	var self = this;
	if(!ids || ids.length === 0)
		return Promise.reject("No calendar ids provided.");
	return new Promise(function(resolve, reject)
	{
		self.calendar.freebusy.query({
			auth: self.auth,
			timeMin: min.format(),
			timeMax: max.format(),
			items: ids.map(function(id){ return { id: id }; })
		}, function(err, response)
		{
			if(err)
			{
				reject(err);
				return;
			}
			var busy = [];
			for(var key in response.calendars)
			{
				var calendar = response.calendars[key];
				if(calendar.errors && calendar.errors.length > 0)
				{
					console.log(calendar.errors);
				}
				else
				{
					[].push.apply(busy, calendar.busy.map(function(time)
					{
						return {
							calendarId: key,
							start: moment(time.start),
							end: moment(time.end)
						};
					}));
				}
				push.sort(function(a, b)
				{
					if(a.start.isBefore(b.start))
						return -1;
					else if(a.start.isSame(b.start))
						return 0;
					else
						return 1;
				});
			}
			resolve(busy);
		});
	});
}

Calendar.prototype.getFreeTimes = function(ids, min, max)
{
	var self = this;
	if(!ids || ids.length === 0)
		return Promise.reject("No calendar ids provided.");
	return this.getBusyTimes.then(function(busy)
	{
		var free = [];
		var start;
		busy.forEach(function(time)
		{
			if(time.end.isBefore(start))
			{
				return;
			}
			else if(time.start.isAfter(start))
			{
				free.push({start: start, end: time.start});
			}
			start = time.end;
		});
		return free;
	});
}

Calendar.prototype.getLocation = function(calendarId)
{
	var self = this;
	if(!calendarId)
		return Promise.reject("No calendar id provided.");
	return new Promise(function(resolve, reject)
	{
		self.calendar.calendarList.get({
			auth: self.auth,
			calendarId: calendarId
		}, function(err, response)
		{
			if(err)
			{
				reject(err);
				return;
			}
			resolve(response.location);
		});
	});
}

Calendar.prototype.setLocation = function(calendarId, location)
{
	var self = this;
	if(!calendarId)
		return Promise.reject("No calendar id provided.");
	return new Promise(function(resolve, reject)
	{
		self.calendar.calendars.patch({
			auth: self.auth,
			calendarId: calendarId,
			resource: {
				location: location
			}
		}, function(err, response)
		{
			if(err)
			{
				reject(err);
				return;
			}
			resolve(response.location);
		});
	});
}

Calendar.prototype.getEvents = function(calendarId)
{
	var self = this;

	if(!calendarId)
		return Promise.reject("No calendar id provided.");

	return new Promise(function(resolve, reject)
	{
		self.calendar.events.list({
			auth: self.auth,
			calendarId: calendarId,
			timeMin: (new Date()).toISOString(),
			maxResults: 10,
			singleEvents: true,
			orderBy: 'startTime'
		}, function(err, response)
		{
			if (err)
			{
				reject(err);
				return;
			}
			resolve(response.items.map(function(event)
			{
				return new Calendar.Event(calendarId, event);
			}));
		});
	});
}

Calendar.prototype.createEvent = function(event, calendarId)
{
	var self = this;

	if(!calendarId)
		return Promise.reject("No calendar id provided.");

	return new Promise(function(resolve, reject)
	{
		self.calendar.events.insert({
			auth: self.auth,
			calendarId: calendarId,
			resource: event.objectify()
		}, function(err, event)
		{
			if(err)
				reject(err);
			else
				resolve(new Calendar.Event(calendarId, event));
		});
	})
}

Calendar.prototype.modifyEvent = function(event, calendarId)
{
	var self = this;

	if(!calendarId)
		return Promise.reject("No calendar id provided.");

	return new Promise(function(resolve, reject)
	{
		self.calendar.events.update({
			auth: self.auth,
			calendarId: calendarId,
			eventId: event.id,
			resource: event.objectify()
		}, function(err, event)
		{
			if(err)
				reject(err);
			else
				resolve(new Calendar.Event(calendarId, event));
		});
	});
}

Calendar.prototype.deleteEvent = function(event, calendarId)
{
	var self = this;

	if(!calendarId)
		return Promise.reject("No calendar id provided.");

	return new Promise(function(resolve, reject)
	{
		self.calendar.events.delete({
			auth: self.auth,
			calendarId: calendarId,
			eventId: event.id
		}, function(err)
		{
			if(err)
				reject(err);
			else
				resolve();
		});
	})
}

/* *******************************
				EVENT
******************************* */

Calendar.Event = function(calendarId, event)
{
	this.calendarId = calendarId || false;
	this.id = false;
	if(event)
	{
		this.id = event.id || false;
		this.summary = event.summary;
		this.location = event.location || false;
		this.start = moment(event.start.dateTime || event.start.date);
	}
}

Calendar.Event.prototype.setDate = function(date)
{
	if(!this.start)
		this.start = moment();
	this.start.set({"month": date.month(), "date": date.date(), "year": date.year()});
}

Calendar.Event.prototype.setTime = function(time)
{
	if(!this.start)
		this.start = moment();
	this.start.set({"hour": time.hour(), "minute": time.minute(), "second": time.second()});
}

Calendar.Event.prototype.setSummary = function(summary)
{
	this.summary = summary;
}

Calendar.Event.prototype.setLocation = function(location)
{
	this.location = location;
}

Calendar.Event.prototype.objectify = function()
{
	var data = {
		"summary": this.summary,
		"start": {
			"dateTime": this.start.format(),
			"timeZone": "America/Los_Angeles"
		},
		"end": {
			"dateTime": this.start.add(EVENT_LENGTH).format(),
			"timeZone": "America/Los_Angeles"
		}
	};

	if(this.id)
		data.id = this.id;
	if(this.location)
		data.location = this.location;
	return data;
}

Calendar.Event.prototype.toString = function()
{
	return JSON.stringify(this.objectify());
}

/* *******************************
			AUTHORIZATION
******************************* */

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 *
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback)
{
	var clientSecret = credentials.installed.client_secret;
	var clientId = credentials.installed.client_id;
	var redirectUrl = credentials.installed.redirect_uris[0];
	var auth = new googleAuth();
	var oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);

	// Check if we have previously stored a token.
	fs.readFile(TOKEN_PATH, function(err, token)
	{
		if (err)
		{
			getNewToken(oauth2Client, callback);
		}
		else
		{
			oauth2Client.credentials = JSON.parse(token);
			callback(oauth2Client);
		}
	});
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 *
 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback to call with the authorized
 *     client.
 */
function getNewToken(oauth2Client, callback)
{
	var authUrl = oauth2Client.generateAuthUrl({
		access_type: 'offline',
		scope: SCOPES
	});
	console.log('Authorize this app by visiting this url: ', authUrl);
	var rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout
	});
	rl.question('Enter the code from that page here: ', function(code)
	{
		rl.close();
		oauth2Client.getToken(code, function(err, token)
		{
			if (err)
			{
				console.log('Error while trying to retrieve access token', err);
				return;
			}
			oauth2Client.credentials = token;
			storeToken(token);
			callback(oauth2Client);
		});
	});
}

/**
 * Store token to disk be used in later program executions.
 *
 * @param {Object} token The token to store to disk.
 */
function storeToken(token)
{
	try
	{
		fs.mkdirSync(TOKEN_DIR);
	}
	catch (err)
	{
		if (err.code != 'EEXIST')
		{
			throw err;
		}
	}
	fs.writeFile(TOKEN_PATH, JSON.stringify(token));
	console.log('Token stored to ' + TOKEN_PATH);
}

module.exports = Calendar;