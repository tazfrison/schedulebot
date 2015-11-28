var util = require("util");
var EventEmitter = require("events");

var schedule = require("node-schedule");
var moment = require("moment");

var SUMMARY_TIME = "8:00 am";
var NOTIFICATION_TIMES = [
	{ "hours": 3 },
	{ "minutes": 30 },
	{ "minutes": 5 }
];

function Notifier(datastore)
{
	this.datastore = datastore;
	EventEmitter.call(this);
	this.scheduled = {};
}

util.inherits(Notifier, EventEmitter);

Notifier.prototype.init = function()
{
	var self = this;

	var summaryTime = moment(SUMMARY_TIME, "H:mm a");
	if(moment().isAfter(summaryTime))
	{
		summaryTime.add(1, "days");
	}

	this.datastore.getEvents(false, moment(), moment().add(2, "days")).then(function(events)
	{
		if(events && events.length > 0)
			events.forEach(self.schedule.bind(self));
	}, function(err)
	{
		throw err;
	});

	this.summary = schedule.scheduleJob(summaryTime.toDate(), this.dailySummary.bind(this));
}

Notifier.prototype.dailySummary = function()
{
	var self = this;

	var summaryTime = moment(SUMMARY_TIME, "H:mm a");
	if(moment().isAfter(summaryTime))
		summaryTime.add(1, "days");
	this.summary = schedule.scheduleJob(summaryTime.toDate(), this.dailySummary.bind(this));
	this.datastore.getEvents(false, moment(), moment().add(2, "days")).then(function(events)
	{
		if(events && events.length > 0)
		{
			self.emit("summary", events);
			events.forEach(self.schedule.bind(self));
		}
	});
}

Notifier.prototype.schedule = function(event)
{
	var self = this;
	var time;
	var i = 0;
	var create = function(time)
	{
		self.scheduled[event.id] = schedule.scheduleJob(time.toDate(), function()
		{
			self.emit("notify", event);
			if(++i < NOTIFICATION_TIMES.length)
			{
				setTimeout(function()
				{
					create(event.start.clone().subtract(NOTIFICATION_TIMES[i]));
				}, 5000);
			}
		});
	};

	for(var i = 0; i < NOTIFICATION_TIMES.length; ++i)
	{
		time = event.start.clone().subtract(NOTIFICATION_TIMES[i])
		if(moment().isBefore(time))
		{
			create(time);
			break;
		}
	}
}

Notifier.prototype.cancel = function(event)
{
	this.scheduled[event.id].cancel();
	delete this.scheduled[event.id];
}

module.exports = Notifier;