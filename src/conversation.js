function Conversation (me, them, datastore, sendMessage)
{
	var self = this;
	this.chatid = them.friendid;
	this.me = me;
	this.them = them;
	this.datastore = datastore;
	this.log = this.datastore.getLog(this.chatid);
	this.sendMessage = function(message)
	{
		self.log.write(self.me.player_name, message);
		sendMessage(message);
	};
}

Conversation.prototype.handleMessage = function(message)
{
	this.log.write(this.them.player_name, message);
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