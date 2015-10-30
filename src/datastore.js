var fs = require("fs");
var path = require("path");
var resources = path.join(path.dirname(fs.realpathSync(__filename)), '../resources');
var logs = path.join(resources, 'logs');

function Datastore ()
{
	this.logfiles = {};
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

Datastore.prototype.getSchedule = function()
{

}

Datastore.prototype.getLog = function(id)
{
	if(!this.logfiles[id])
		this.logfiles[id] = new Datastore.log(id);
	return this.logfiles[id];
}

Datastore.log = function(id)
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

Datastore.log.prototype.write = function(name, message)
{
	var output = "[" + getTimeString() + "] " + name + ": " + message + "\n";

	fs.appendFile(this.path, output);
}

module.exports = Datastore;