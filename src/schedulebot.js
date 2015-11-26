var fs = require("fs");
var crypto = require("crypto");
var readline = require("readline");
var EventEmitter = require("events");
var util = require("util");

var Steam = require("steam");

var PlayerConversation = require("./player_conversation.js");
var SchedulerConversation = require("./scheduler_conversation.js");
var AdminConversation = require("./admin_conversation.js");
var Confirmation = require("./confirmation.js");

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
	this.me = false;

	this.setupHandlers();

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

	if(state.friendid === this.client.steamID)
	{
		this.me = state;
	}
}

ScheduleBot.prototype.onFriendMessage = function(steamId, message, type)
{
	console.log("Received message: '" + message + "' from " + this.getUserName(steamId));
	if(message == "")
		return;
	var log = this.datastore.getLog(steamId);
	if(!this.conversations[steamId])
	{
		this.newConversation(steamId);
	}
	log.write(this.friends.personaStates[steamId].player_name, message);
	try
	{
		this.conversations[steamId].handleMessage(message);
	}
	catch(e)
	{
		console.log(e.message, e.stack);
	}
}

/* *******************************************
				MESSAGE HANDLING
******************************************* */

ScheduleBot.prototype.sendMessage = function(steamId)
{
	var self = this;
	var log = this.datastore.getLog(steamId);
	return function(message)
	{
		log.write(self.me.player_name, message);
		self.friends.sendMessage(steamId, message, Steam.EChatEntryType.ChatMsg);
	};
}

ScheduleBot.prototype.newConversation = function(steamId)
{
	var self = this;
	var player = this.datastore.getPlayer(steamId);
	var conversationType = false;
	var log = this.datastore.getLog(steamId);
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
		log.write(this.me.player_name, unregistered);
		this.friends.sendMessage(steamId, unregistered, Steam.EChatEntryType.ChatMsg);
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

ScheduleBot.prototype.confirmEvent = function(event, scheduledBy)
{
	var self = this;
	var primary = this.datastore.getPrimaryTeam();
	if(event.calendarId === primary.calendarId)
	{
		return Promise.resolve();
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
				confirmation.on("accept", function()
				{
					resolve();
					self.conversations[scheduler.id].resume();
				})
				.on("reject", function()
				{
					reject();
					self.conversations[scheduler.id].resume();
				});

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
	if(!scheduledBy.isScheduler(event.calendarId))
	{
		//Confirm with other team
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
				confirmation.on("accept", function()
				{
					resolve(true);
					self.conversations[scheduler.id].resume();
				})
				.on("reject", function()
				{
					resolve(false);
					self.conversations[scheduler.id].resume();
				});

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
	return Promise.all([
		Promise.race(primaryPromises).then(function()
		{
			//End any other active primary confirmations
			finish(true);
		}),
		Promise.race(otherPromises).then(function()
		{
			//End any other active other confirmations
			finish(false);
		})
	]).then(function()
	{
		//End all other confirmations
		finish(true);
		finish(false);
	}, function(err)
	{
		finish(true);
		finish(false);
	});
}

ScheduleBot.prototype.notifyTeam = function(teamId, event, type)
{
	var self = this;
	var team = this.datastore.getTeam(teamId);
	var ids = team.roster.concat(team.schedulers).map(function(person)
	{
		return person.id;
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
	ids.forEach(function(id)
	{
		var log = self.datastore.getLog(id);
		if(!self.conversations[id])
		{
			self.newConversation(id);
		}

		self.conversations[id].interrupt(message);
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

function FriendsWrapper(client)
{
	Steam.SteamFriends.apply(this, arguments);

	var self = this;
	this.once("relationships", function()
	{
		Object.keys(self.friends).forEach(function(id)
		{
			self.onFriend(id, self.friends[id]);
		});
		self.setPersonaState(Steam.EPersonaState.Online);
		self.emit("ready");
	});
}

util.inherits(FriendsWrapper, Steam.SteamFriends);

FriendsWrapper.prototype.setupHandlers = function()
{
	this.on("friend", this.onFriend.bind(this));
	this.on("personaState", this.onPersonaState.bind(this));
}

FriendsWrapper.prototype.onFriend = function(id, relationship)
{
	if(relationship === Steam.EFriendRelationship.RequestRecipient)
		this.emit("requestReceived", id);
}

FriendsWrapper.prototype.onPersonaState = function(state)
{
	var id = state.friendid;
	var previousState = this.personaStates[id];
	if(!previousState)
	{
		this.emit(id + ".newData");
		return;
	}
	if(previousState.player_name !== state.player_name)
		this.emit("nameChange", state);
	if(previousState.persona_state !== state.persona_state)
	{
		if(previousState.persona_state === Steam.EPersonaState.Offline)
			this.emit(id + ".online", state);
		else if(state.persona_state === Steam.EPersonaState.Offline)
			this.emit(id + ".offline", state);
	}
}

FriendsWrapper.prototype.getStatus = function(steamId)
{
	if(!this.personaStates[steamId])
		return Steam.EPersonaState.Offline;
	else
		return this.personaStates[steamId].persona_state;
}

FriendsWrapper.prototype.getUserName = function(id)
{
	return (this.personaStates && id in this.personaStates)
		? (this.personaStates[id].player_name)
		: "";
}

module.exports = ScheduleBot;