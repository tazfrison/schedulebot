var util = require("util");

var Conversation = require("./conversation.js");

function PlayerConversation()
{
	var self = this;

	Conversation.apply(this, arguments);
	this.menuOptions = [
		{label: "List currently scheduled scrims.", action: this.listScrims.bind(this)}
	];

	this.playsOnPrimary = false;
	this.player.playsOn.every(function(team)
	{
		if(team.primary)
		{
			self.playsOnPrimary = true;
			return false;
		}
	});

	return; //Unimplemented
	if(this.playsOnPrimary)
		this.menuOptions.push({ label: "Update your availability.", action: this.availability.bind(this)})
}

util.inherits(PlayerConversation, Conversation);

PlayerConversation.prototype.getEvents = function()
{
	var ids = [];
	if(!this.playsOnPrimary)
	{
		ids = this.player.playsOn.map(function(team){return team.calendarId;});
	}
	return this.datastore.getEvents(ids);
}

PlayerConversation.prototype.listScrims = function()
{
	var self = this;
	this.busy();
	this.getEvents().then(function(events)
	{
		var output = "Upcoming scrims:\n\t" + events.map(self.friendlyEvent).join("\n\t");
		self.sendMessage(output);
		self.cancel();
	},
	function(err)
	{
		console.log(err);
	});
}

PlayerConversation.prototype.availability = function()
{
	var self = this;
	this.busy();
	this.datastore.getUnavailable(this.player.id).then(function(times)
	{
		var options = times.map(function(time)
		{
			return {
				label: self.friendlyAvailability(time),
				action: function()
				{
					self.state.availability = time;
					self.registerHistory(self.availability.bind(self));
					self.changeAvailability();
				}
			};
		});

		options.push({
			label: "Create new unavailable time.",
			action: function()
			{

			}
		})

		self.makeMenu({
			label: "Your current unavailable times:",
			listOptions: options
		});
	}, function(err)
	{
		console.log(err);
	});
}

PlayerConversation.prototype.changeAvailability = function()
{
	var self = this;
	if(!this.state.availability)
		this.cancel();
	this.makeMenu({
		label: "What do you want to change?",
		listOptions: [
			{ label: "", action: function()
				{

				}}
		]
	});
}

PlayerConversation.prototype.friendlyAvailability = function(availability)
{

}

module.exports = PlayerConversation;