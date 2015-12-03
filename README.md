# ScheduleBot (Better name pending)

A Node.js script to interface with Steam and Google Calendar for the purpose of automating and simplifying the process for scheduling scrimmages for a competitive gaming team.  Originally created for The Petting Tzu, a Team Fortress 2 team.

## Installation

### Requirements
* NPM
* Nodejs (^v4.1.1)
* Python (High version 2s)

### Git
* Clone the repository
* NPM install at package root
* Watch node-gyp fail
* Cry

### Zip
* Download zip
* NPM install at package root
* Watch node-gyp fail
* Cry

## Getting Started
Eventually there will be a quickstart script that will walk you through initial setup.  Here's how it'll work:

### quickstart.js
In package root, run `nodejs quickstart.js`.  It will walk you through the following steps:
* First, it will ask for the username and password of the Steam account the bot will use.  I'd recommend creating a new Steam account for the bot to use, since you can't use the account while the bot is active.  The bot currently can't handle accounts with SteamGuard active, though it is a planned enhancement.
* Next it will ask for your personal Steam ID.  This is so it can add your Steam as an admin to the bot, giving you the ability to finish configuration and long term use.  If the Steam account the bot is using is a free account, then you'll need to send the bot a friend request, as free accounts can only receive friend requests.
* Next it will output a link to a Google page.  On this page you will need to log in to the Google Account who's calendar the bot will use.
* Currently the bot saves the Steam credentials to the disk in plaintext, so be careful.  Ideally it will save a token instead, but it doesn't yet.  The Google access is stored as an encrypted token, however.

### schedulebot
* After completing quickstart, you can launch the bot from package root with `nodejs schedulebot` (currently only works on Linux, need to improve the launch script for it to work on Windows systems.  No idea about Macs).
* Once launched, the bot will attempt to log into Steam and Google Calendars.  If successful, the Steam account will show up as Online in chat (make sure the bot's account is on your friends list).
* You can now start setting up the players, schedulers, and teams that the bot will interact with.
* Once that is done (and friend requests are sent appropriately, remember those pesky free account limitations), designated schedulers can begin scheduling events.  See the wiki for instructions on how to use Steam chat to perform the previous actions.
