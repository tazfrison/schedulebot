var fs = require("fs");
var crypto = require("crypto");
var readline = require("readline");
var util = require("util");

var Steam = require("steam");

var PlayerConversation = require("./player_conversation.js");
var SchedulerConversation = require("./scheduler_conversation.js");
var AdminConversation = require("./admin_conversation.js");
var Confirmation = require("./confirmation.js");
var Notifier = require("./notifier.js");
var FriendsWrapper = require("./friends_wrapper.js");

function ScheduleBot(datastore)
{
	var self = this;
	this.datastore = datastore;

	this.datastore.init().then(function()
	{
		self.init();
	},
	function(err)
	{
		console.log("ScheduleBot failed to initialize: " + err);
	});
}

ScheduleBot.prototype.init = function()
{
	var config = this.datastore.getSteamLogin();
	if(!config)
	{
		console.log("Config file not found.");
		process.exit();
	}
	this.username = config.username;
	this.password = config.password;

	config = this.datastore.getServers();
	if(!config)
	{
		Steam.servers = config;
	}

	this.rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout
	});

	this.conversations = {};

	this.client = new Steam.SteamClient();
	this.friends = new FriendsWrapper(this.client);
	this.user = new Steam.SteamUser(this.client);
	this.notifier = new Notifier(this.datastore);

	this.setupHandlers();

	this.notifier.init();

	this.client.connect();
}

ScheduleBot.prototype.setupHandlers = function()
{
	this.client.on("connected", this.onClientConnect.bind(this));
	this.client.on('servers', this.onClientServers.bind(this));
	this.client.on("logOnResponse", this.onClientLogOn.bind(this));
	this.client.on("loggedOff", this.onClientLogOff.bind(this));

	//this.user.on("updateMachineAuth", this.onUserUpdateMachineAuth.bind(this));

	this.friends.setupHandlers();

	this.friends.on("friendMsg", this.onFriendMessage.bind(this));
	this.friends.on("requestReceived", this.onFriendRequestReceived.bind(this));
	this.friends.on("nameChange", this.onFriendNameChange.bind(this));

	this.notifier.on("summary", this.onNotifierSummary.bind(this));
	this.notifier.on("notify", this.onNotifierNotify.bind(this));
}

ScheduleBot.prototype.loggedOn = function()
{
	var self = this;
	this.friends.once("ready", function()
	{
		self.rl.on("line", self.handleCommand.bind(self));
	});
}

ScheduleBot.prototype.handleCommand = function(command)
{
	var moment = require("moment");
	var self = this;
	if(command === "exit")
	{
		this.rl.close();
		this.client.disconnect();
		process.exit();
	}
	else if(command === "listfriends")
	{
		this.listFriends();
	}
	else if(command.lastIndexOf("acceptfriend", 0) === 0)
	{
		var id = command.split(" ", 2)[1];
		this.friends.addFriend(id);
	}
	else if(command.lastIndexOf("message", 0) === 0)
	{
		command = command.split(" ");
		var id = command[1];
		this.friends.sendMessage(id, command.slice(2).join(" "), Steam.EChatEntryType.ChatMsg);
	}
	else if(command.lastIndexOf("status", 0) === 0)
	{
		command = command.split(" ");
		var id = command[1];
		var friend = this.datastore.getPlayer(id);
		console.log(friend.name + " status: ", this.friends.personaStates[id]);
	}
	else if(command.lastIndexOf("getfree", 0) === 0)
	{
		command = command.split(" ");
		var min = moment(command[1], "M/D");
		this.datastore.getFreeTimes(min).then(function(times)
			{
				console.log(times.map(function(time){return time.start.format() + " - " + time.end.format()}));
			}, console.log);
	}
	else if(command.lastIndexOf("getbusy", 0) === 0)
	{
		command = command.split(" ");
		var min = moment(command[1], "M/D");
		this.datastore.getBusyTimes(min).then(function(times)
			{
				console.log(times.map(function(time){return time.start.format() + " - " + time.end.format()}));
			}, console.log);
	}
	else if(command === "getsummary")
	{
		this.notifier.dailySummary();
	}
}

ScheduleBot.prototype.listFriends = function()
{
	console.log(this.friends.personaStates);
}

ScheduleBot.prototype.acceptFriend = function(id)
{
	if(this.datastore.getPlayer(id))
	{
		console.log("Accepting friend: " + this.friends.getUserName(id) + "(" + id + ")");
		this.friends.addFriend(id);
	}
	else
	{
		console.log("Player not in config: " + this.friends.getUserName(id) + "(" + id + ")");
	}
}

/* **********************************
			EVENT HANDLERS
********************************** */

ScheduleBot.prototype.onClientConnect = function()
{
	console.log("Connected");
	this.user.logOn({
		account_name: this.username,
		password: this.password
	});
}

ScheduleBot.prototype.onClientServers = function(servers)
{
	this.datastore.setServers(servers);
}

ScheduleBot.prototype.onClientLogOn = function(response)
{
	if(response.eresult !== 1)
	{
		console.log("Logon error: ", response);
	}
	console.log("Logged on");
	this.loggedOn();
}

ScheduleBot.prototype.onClientLogOff = function(response)
{
	console.log("Logged off: ", response);
}

ScheduleBot.prototype.onUserUpdateMachineAuth = function(sentry, callback)
{
	this.datastore.setSentry(this.username, sentry.bytes);
	callback({
		sha_file: crypto.createHash('sha1').update(sentry.bytes).digest()
	});
}

ScheduleBot.prototype.onFriendRequestReceived = function(id)
{
	if(this.friends.getUserName(id) !== "")
	{
		this.acceptFriend(id);
	}
	else
	{
		var self = this;
		this.friends.once(id + ".newData", function()
		{
			setTimeout(function()
			{
				self.acceptFriend(id);
			});
		})
		this.friends.requestFriendData([id]);
	}
}

ScheduleBot.prototype.onFriendNameChange = function(state)
{
	var player = this.datastore.getPlayer(state.friendid);
	if(player && player.name !== state.player_name)
	{
		player.name = state.player_name;
		this.datastore.saveTeamData();
	}
}

ScheduleBot.prototype.onFriendMessage = function(steamId, message, type)
{
	console.log("Received message: '" + message + "' from " + this.friends.getUserName(steamId));
	if(message == "")
		return;
	if(!this.conversations[steamId])
	{
		this.newConversation(steamId);
	}
	try
	{
		this.conversations[steamId].handleMessage(message);
	}
	catch(e)
	{
		console.log(e.message, e.stack);
	}
}

ScheduleBot.prototype.onNotifierSummary = function(events)
{
	this.notifyTeam(this.datastore.getPrimaryTeam().calendarId, events, "summary");
}

ScheduleBot.prototype.onNotifierNotify = function(event)
{
	this.notifyTeam(this.datastore.getPrimaryTeam().calendarId, event, "reminder");
}

/* *******************************************
				MESSAGE HANDLING
******************************************* */

ScheduleBot.prototype.sendMessage = function(steamId)
{
	var self = this;
	return function(message)
	{
		self.friends.sendMessage(steamId, message);
	};
}

ScheduleBot.prototype.newConversation = function(steamId)
{
	var self = this;
	var player = this.datastore.getPlayer(steamId);
	var conversationType = false;
	if(player)
	{
		if(player.admin)
			conversationType = AdminConversation;
		else if(player.schedulesFor.length > 0)
			conversationType = SchedulerConversation;
		else if(player.playsOn.length > 0)
			conversationType = PlayerConversation;
	}
	if(conversationType === false)
	{
		var unregistered = "You are unregistered with this bot.  Please contact an admin or your team's scheduler to be added to the bot.";
		this.sendMessage(steamId)(unregistered);
	}
	else
	{
		this.conversations[steamId] = new conversationType(
			steamId, this.datastore, this.sendMessage(steamId));
		this.conversations[steamId].on("schedule", function(event)
		{
			self.confirmEvent(event, player).then(function(resolved)
			{
				if(resolved === true)
				{
					self.updateEvent(event);
					self.conversations[steamId].interrupt("Scrim accepted.");
				}
				else if(resolved === false)
				{
					self.conversations[steamId].interrupt("Scrim rejected.");
				}
			}, function(err)
			{
				throw err;
			});
		}).on("reschedule", function(event)
		{
			self.confirmEvent(event, player).then(function(resolved)
			{
				if(resolved === true)
				{
					self.updateEvent(event);
					self.conversations[steamId].interrupt("Reschedule accepted.");
				}
				else if(resolved === false)
				{
					self.conversations[steamId].interrupt("Reschedule rejected.");
				}
			}, function(err)
			{
				throw err;
			});
		}).on("cancel", function(event)
		{
			self.datastore.cancelEvent(event).then(function()
			{
				var primaryId = self.datastore.getPrimaryTeam().calendarId;
				self.notifyTeam(primaryId, event, "cancel");
				if(event.calendarId !== primaryId)
					self.notifyTeam(calendarId, event, "cancel");
			}, function(err)
			{
				throw err;
			})
		});
	}
}

ScheduleBot.prototype.notifyTeam = function(teamId, event, type)
{
	var self = this;
	var team = this.datastore.getTeam(teamId);
	var ids = team.roster.concat(team.schedulers).map(function(person)
	{
		return person.id;
	}).filter(function(item, pos, self) {
	    return self.indexOf(item) == pos;
	});
	var message;
	if(type === "confirm")
	{
		message = event.summary + " scheduled for "
			+ event.start.format("ddd, MMM Do, h:mm:ss a");
	}
	else if(type === "reminder")
	{
		message = "Reminder that " + event.summary
			+ " is " + event.start.toNow()
			+ " ( " + event.start.format("h:mm:ss a") +" )";
	}
	else if(type === "cancel")
	{
		message = event.summary + " on "
			+ event.start.format("ddd, MMM Do")
			+ " has been canceled.";
	}
	else if(type === "summary")
	{
		message = "Upcoming events:\n\t" + event.map(function(event)
		{
			return event.start.format("h:mm:ss a") + ": " + event.summary;
		}).join("\n\t");
	}
	else
	{
		return;
	}
	ids.forEach(function(id)
	{
		if(!self.conversations[id])
		{
			self.newConversation(id);
		}

		self.conversations[id].interrupt(message);
	});
}

/* *******************************************
			SCHEDULE MODIFICATIONS
******************************************* */

ScheduleBot.prototype.confirmEvent = function(event, scheduledBy)
{
	var self = this;
	var primary = this.datastore.getPrimaryTeam();
	if(event.calendarId === primary.calendarId)
	{
		return Promise.resolve(true);
	}
	var other = this.datastore.getTeam(event.calendarId);

	var primaryPromises = [];
	var otherPromises = [];
	var primaryConfirmations = [];
	var otherConfirmations = [];
	var primaryPending = {};
	var otherPending = {};

	var finish = function(primary)
	{
		var pending = primary ? primaryPending : otherPending;
		var confirmations = primary ? primaryConfirmations : otherConfirmations;
		Object.keys(pending).forEach(function(key)
		{
			self.friends.removeListener(key + ".online", pending[key]);
		});
		confirmations.forEach(function(confirmation)
		{
			confirmation.cancel();
		});
		if(primary)
		{
			primaryPending = {};
			primaryConfirmations = [];
		}
		else
		{
			otherPending = {};
			otherConfirmations = [];
		}
	};

	var interrupt = function(id, confirmation)
	{
		if(!self.conversations[id])
		{
			self.newConversation(id);
		}
		self.conversations[id].interrupt({
			label: "Scrim between "
				+ other.name
				+ " and " + primary.name
				+ " scheduled by " + scheduledBy.name,
			action: confirmation
		});
	};

	if(!scheduledBy.isScheduler(primary.calendarId))
	{
		console.log("Confirm primary");
		//Confirm with primary team
		primary.schedulers.forEach(function(scheduler)
		{
			var confirmation;
			var promise = new Promise(function(resolve, reject)
			{
				confirmation = new Confirmation(scheduler.id,
					self.datastore,
					self.sendMessage(scheduler.id),
					event);
				confirmation.on("accept", resolve)
				.on("reject", reject);

				primaryConfirmations.push(confirmation);
			});
			primaryPromises.push(promise);
			if(scheduledBy.isScheduler(other.calendarId))
			{
				otherConfirmations.push(confirmation);
				otherPromises.push(promise);
			}

			if(self.friends.getStatus(scheduler.id) !== Steam.EPersonaState.Online)
			{
				primaryPending[scheduler.id] = function()
				{
					delete primaryPending[scheduler.id];
					interrupt(scheduler.id, confirmation);
				};
				self.friends.once(scheduler.id + ".online", primaryPending[scheduler.id]);
				return;
			}
			interrupt(scheduler.id, confirmation);
		});
	}
	else
	{
		console.log("Scheduler is primary");
		primaryPromises.push(Promise.resolve(true));
	}
	if(!scheduledBy.isScheduler(event.calendarId))
	{
		//Confirm with other team
		console.log("Confirm other");
		other.schedulers.forEach(function(scheduler)
		{
			if(scheduler.isScheduler(primary.calendarId))
				return;

			var confirmation;
			otherPromises.push(new Promise(function(resolve, reject)
			{
				confirmation = new Confirmation(scheduler.id,
					self.datastore,
					self.sendMessage(scheduler.id),
					event);
				confirmation.on("accept", resolve)
				.on("reject", reject);

				otherConfirmations.push(confirmation);
			}));

			if(self.friends.getStatus(scheduler.id) !== Steam.EPersonaState.Online)
			{
				otherPending[scheduler.id] = function()
				{
					delete otherPending[scheduler.id];
					interrupt(scheduler.id, confirmation);
				};
				self.friends.once(scheduler.id + ".online", otherPending[scheduler.id]);
				return;
			}
			interrupt(scheduler.id, confirmation);
		});
	}
	else
	{
		console.log("Scheduler is other");
		otherPromises.push(Promise.resolve(true));
	}

	return new Promise(function(resolve, reject)
	{
		Promise.all([
			Promise.race(primaryPromises).then(function(result)
				{
					console.log("Resolve primary", result);
					//End any other active primary confirmations
					finish(true);
					if(result === false)
					{
						finish(false);
						resolve(false);
					}
					return result;
				}, function(err)
				{
					console.log("Error primary", err);
					finish(true);
					finish(false);
					reject(err);
				}),
			Promise.race(otherPromises).then(function(result)
				{
					console.log("Resolve other", result);
					//End any other active other confirmations
					finish(false);
					if(result === false)
					{
						finish(true);
						resolve(false);
					}
					return result;
				}, function(err)
				{
					console.log("Error other", err);
					finish(true);
					finish(false);
					reject(err);
				})
		]).then(function(result)
		{
			console.log("Resolve all", result);
			//End all other confirmations
			finish(true);
			finish(false);
			resolve(result[0] === result[1] === true);
		}, function(err)
		{
			console.log("Error all", err);
			finish(true);
			finish(false);
			reject(err);
		});
	});
}

ScheduleBot.prototype.updateEvent = function(event)
{
	console.log("Creating event");
	return this.datastore.setEvent(event).then(function(event)
	{
		//Notify teams
		var primaryId = this.datastore.getPrimaryTeam().calendarId;
		if(event.scheduleId !== primaryId)
			this.notifyTeam(event.scheduleId, event, "confirm");
		this.notifyTeam(primaryId, event, "confirm");
	});
}

module.exports = ScheduleBot;