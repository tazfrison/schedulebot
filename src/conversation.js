function Conversation (me, them, datastore, sendMessage)
{
	this.chatid = them.friendid;
	this.me = me;
	this.them = them;
	this.datastore = datastore;
	this.sendMessage = sendMessage;
}

Conversation.prototype.handleMessage = function(message)
{
	this.datastore.logMessage(this.chatid, this.them.player_name, "", message);
	this.sendMessage("Responding to: " + message);
}

Conversation.prototype.updateState = function(state)
{
	this.them = state;
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

Conversation.prototype.schedule = function()
{
	
}

Conversation.prototype.cancel = function()
{

}

module.exports = Conversation;