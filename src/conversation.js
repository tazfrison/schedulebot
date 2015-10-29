function Conversation (id, sendMessage)
{
	this.id = id;
	this.sendMessage = sendMessage;
}

Conversation.prototype.handleMessage = function(message)
{
	this.sendMessage("Responding to: " + message);
}

Conversation.prototype.printOptions = function()
{
	this.sendMessage("\n\
		1: List currently scheduled scrims.\n\
		2: Schedule a new scrim.\n\
		3: Reschedule an existing scrim.\n\
		4: Cancel a scrim.");
}

Conversation.prototype.listScrims = function()
{

}

Conversation.prototype.

module.exports = Conversation;