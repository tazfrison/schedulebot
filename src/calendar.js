var fs = require("fs");
var path = require("path");
var readline = require("readline");

var moment = require("moment");
var Promise = require("promise");
var google = require("googleapis");
var googleAuth = require("google-auth-library");

var SCOPES = ["https://www.googleapis.com/auth/calendar"];
var TOKEN_DIR = path.join(path.dirname(fs.realpathSync(__filename)), "../resources/.credentials/");
var TOKEN_PATH = path.join(TOKEN_DIR, "calendar-nodejs-schedulebot.json");

var CLIENT_AUTH = path.join(TOKEN_DIR, "client_secret.json");

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

/**
 * Lists the next 10 events on the user's primary calendar.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
Calendar.prototype.listEvents = function(calendarId)
{
	this.calendar.events.list({
		auth: this.auth,
		calendarId: calendarId || 'primary',
		timeMin: (new Date()).toISOString(),
		maxResults: 10,
		singleEvents: true,
		orderBy: 'startTime'
	}, function(err, response)
	{
		if (err)
		{
			console.log('The API returned an error: ' + err);
			return;
		}
		var events = response.items;
		if (events.length == 0)
		{
			console.log('No upcoming events found.');
		}
		else
		{
			console.log('Upcoming 10 events:');
			for (var i = 0; i < events.length; i++)
			{
				var event = events[i];
				var start = event.start.dateTime || event.start.date;
				console.log('%s - %s', start, event.summary);
			}
		}
	});
}

Calendar.prototype.getEvents = function(calendarId)
{
	var self = this;
	return new Promise(function(resolve, reject)
	{
		self.calendar.events.list({
			auth: self.auth,
			calendarId: calendarId || 'primary',
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

	return new Promise(function(resolve, reject)
	{
		self.calendar.events.insert({
			auth: self.auth,
			calendarId: calendarId || "primary",
			resource: event.objectify()
		}, function(err, event)
		{
			if(err)
				reject(err);
			else
				resolve(event);
		});
	})
}

Calendar.prototype.modifyEvent = function(event, calendarId)
{
	var self = this;

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
				resolve(event);
		});
	});
}

Calendar.prototype.deleteEvent = function(event, calendarId)
{
	var self = this;

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
	this.start.set({"month": date.month(), "day": date.day(), "year": date.year()});
}

Calendar.Event.prototype.setTime = function(time)
{
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
			"dateTime": this.start.add(30, "minutes").format(),
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