var fs = require("fs");
var path = require("path");

function Datastore ()
{
	this.resources = path.join(path.dirname(fs.realpathSync(__filename)), '../resources');
}

Datastore.prototype.getSteamLogin = function()
{
	var confPath = path.join(this.resources, "login.conf");
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
	var confPath = path.join(this.resources, "servers");
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
	var confPath = path.join(this.resources, "servers");
	fs.writeFile(confPath, JSON.stringify(serverFile));
}

Datastore.prototype.getSentry = function(username)
{
	var sentryPath = path.join(this.resources, "bot." + username + ".sentry");
	return false;
}

Datastore.prototype.setSentry = function(username, sentry)
{
	var sentryPath = path.join(this.resources, "bot." + username + ".sentry");
	fs.writeFileSync(sentryPath, sentry);
}

Datastore.prototype.getSchedule = function()
{

}

Datastore.prototype.logMessage = function(id, name, time, message)
{

}

module.exports = Datastore;