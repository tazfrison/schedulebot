var util = require("util");

var Conversation = require("./conversation.js");

function Confirmation(id, datastore, sendMessage, event)
{
	var self = this;

	Conversation.apply(this, arguments);

	this.event = event;
}

util.inherits(Confirmation, Conversation);

Confirmation.prototype.mainmenu = function()
{
	var self = this;

	this.registerHistory(arguments);

	this.makeMenu({
		label: "A scrim has been requested: "
			+ this.event.summary + " at "
			+ this.event.start.format(),
		listOptions: [
			{label: "Accept scrim.", action: function(){self.emit("return", true);self.emit("accept");}},
			{label: "Reject scrim.", action: function(){self.emit("return", true);self.emit("reject");}}
		]
	});
}

Confirmation.prototype.cancel = function()
{
	self.emit("return");
}

module.exports = Confirmation;