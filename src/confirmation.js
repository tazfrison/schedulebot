var util = require("util");

var SchedulerConversation = require("./scheduler_conversation.js");

function Confirmation(id, datastore, sendMessage, event)
{
	var self = this;

	SchedulerConversation.apply(this, arguments);

	this.event = event;
}

util.inherits(Confirmation, SchedulerConversation);

Confirmation.prototype.mainmenu = function()
{
	var self = this;

	this.registerHistory(arguments);

	this.makeMenu({
		label: "A scrim has been requested: "
			+ this.event.summary + " at "
			+ this.event.start.format(),
		listOptions: [
			{label: "Accept scrim.", action: function(){self.emit("accept");}},
			{label: "Reject scrim.", action: function(){self.emit("reject");}}
		]
	});
}

module.exports = Confirmation;