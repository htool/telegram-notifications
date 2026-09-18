process.env.NTBA_FIX_319 = 1; // or require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const geolib = require('geolib');
const PLUGIN_ID = 'telegram-notifications';
const PLUGIN_NAME = 'Telegram notifications';
var unsubscribes = [];
var bot;
var chatids;

var buddiesState = {}

module.exports = function(app) {
  var plugin = {};

  plugin.id = PLUGIN_ID;
  plugin.name = PLUGIN_NAME;
  plugin.description = 'A plugin to send telegram notifications when an event occurs';

  plugin.start = function(options, restartPlugin) {
    plugin.options = options;
    chatids = options.chatids;
    app.debug('Plugin started. Using chatids: ' + chatids.join(','));
    let token = options.bot.token;
    // Create a bot that uses 'polling' to fetch new updates
    bot = new TelegramBot(token, {polling: true});
    // app.debug('Options: ' + JSON.stringify(options));
    options.notifications.forEach(option => listen(option));

    let localSubscription = {
      context: 'vessels.self', // Get data for all contexts
      subscribe: [{
        path: 'notifications.buddy.*', // Get all paths
        policy: 'instant',
      }]
    };

    app.subscriptionmanager.subscribe(
      localSubscription,
      unsubscribes,
      subscriptionError => {
        app.error('Error:' + subscriptionError);
      },
      delta => {
        delta.updates.forEach(u => {
          app.debug('u: ' + JSON.stringify(u));
          var path = u['values'][0]['path']
          app.debug('path: %s', path)
          var message = u['values'][0]['value']['message'];
          app.debug('message: ' + message);
          var message = message.replace(/Your buddy /, '');
          app.debug('message: ' + message);
          if (buddiesState[path] !== message) {
            sendMessage(message);
          } else {
            app.debug('Duplicate message: %s', message)
          }
          buddiesState[path] = message
        });
      }
    );

    bot.on('message', (msg) => {
      let chatId = msg.chat.id;
      globalChatId = chatId;
      let text = msg.text.toLowerCase();
      app.debug('Message: ' + JSON.stringify(msg));
      app.debug('Options: ' + JSON.stringify(options));
      var reply = '';

      try {
      if (text == 'temp') {
        var element;
        try {
          element = app.getSelfPath('environment.outside.temperature');
          app.debug('Temp: ' + JSON.stringify(element));
          reply += 'Outside ' + elementToString(element);
        } catch (e) {}
        try {
          element = app.getSelfPath('environment.inside.hutachterstuurboord.temperature');
          app.debug('Temp: ' + JSON.stringify(element));
          reply += ', hut acher sb ' + elementToString(element);
        } catch (e) {}
        try {
          element = app.getSelfPath('environment.inside.hutachterbakboord.temperature');
          app.debug('Temp: ' + JSON.stringify(element));
          reply += ', hut achter bb ' + elementToString(element);
        } catch (e) {}
        try {
          element = app.getSelfPath('environment.inside.hutvoor.temperature');
          app.debug('Temp: ' + JSON.stringify(element));
          reply += ', hut voor ' + elementToString(element);
        } catch (e) {}
        try {
          element = app.getSelfPath('environment.inside.fridge.temperature');
          app.debug('Temp: ' + JSON.stringify(element));
          reply += ', fridge ' + elementToString(element);
        } catch (e) {}
        try {
          element = app.getSelfPath('environment.water.temperature');
          app.debug('Temp: ' + JSON.stringify(element));
          reply += ', water ' + elementToString(element);
        } catch (e) {}
      } else
      if (text == 'humidity') {
        var element;
        try {
          element = app.getSelfPath('environment.outside.humidity');
          app.debug('Humidity: ' + JSON.stringify(element));
          reply += 'Outside ' + elementToString(element);
        } catch (e) {}
        try {
          element = app.getSelfPath('environment.inside.fridge.humidity');
          app.debug('Humidity: ' + JSON.stringify(element));
          reply += ', fridge ' + elementToString(element);
        } catch (e) {}
        try {
          element = app.getSelfPath('environment.inside.hutvoor.humidity');
          app.debug('Humidity: ' + JSON.stringify(element));
          reply += ', hut voor ' + elementToString(element);
        } catch (e) {}
        try {
          element = app.getSelfPath('environment.inside.hutachterbakboord.humidity');
          app.debug('Humidity: ' + JSON.stringify(element));
          reply += ', hut bakboord ' + elementToString(element);
        } catch (e) {}
        try {
          element = app.getSelfPath('environment.inside.hutachterstuurboord.humidity');
          app.debug('Humidity: ' + JSON.stringify(element));
          reply += ', hut stuurboord ' + elementToString(element);
        } catch (e) {}
      } else
      if (text == 'buddy') {
        const buddies = app.getSelfPath('notifications.buddy');
        if (typeof buddies != 'undefined') {
          Object.values(buddies).forEach(buddy => {
            reply += buddy.value.message.replace(/Your buddy /, '') + '\n';
          });
        } else {
          reply += 'No buddies nearby\n';
        }
      } else
      if (text == 'starlink') {
        element = app.getSelfPath('electrical.switches.starlink.state');
        app.debug('Starlink: ' + JSON.stringify(element));
        onoff = elementToString(element)
        reply += "Starlink power: " + onoff
        if (onoff == "on") {
          element = app.getSelfPath('network.providers.starlink.status');
          app.debug('Starlink network status: ' + JSON.stringify(element));
        } 
      } else
      if (text == 'batt') {
        const batteries = app.getSelfPath('electrical.batteries') || {};
        for (const [id, element] of Object.entries(batteries)) {
          try {
            if (
              !element ||
              typeof element !== 'object' ||
              !element.voltage ||
              typeof element.name == 'undefined'
            ) {
              continue;
            }
            app.debug('Batt: ' + JSON.stringify(element));
            var prefix = elementName(element) + 'battery ';
            const soc = element.capacity && element.capacity.stateOfCharge;
            if (typeof soc != 'undefined') {
              reply += prefix + elementToString(soc, 'stateOfCharge') + ', ' + elementToString(element.voltage);
            } else {
              reply += prefix + elementToString(element.voltage);
            }
            if (element.current) {
              reply += ', ' + elementToString(element.current);
            }
            reply += '\n';
          } catch (e) {
            app.debug('Batt error ' + id + ': ' + e);
          }
        }
      } else
      if (text == 'tank') {
        Object.values(app.getSelfPath('tanks.freshWater')).forEach(element => {
          app.debug('Tank: ' + JSON.stringify(element));
          var prefix = elementName(element) + '(' + element.type.value + ') tank ';
          reply += prefix + elementToString(element.currentLevel) + ', ' + elementToString(element.currentVolume) + '\n';
        });
        Object.values(app.getSelfPath('tanks.fuel')).forEach(element => {
          app.debug('Tank: ' + JSON.stringify(element));
          var prefix = elementName(element) + '(' + element.type.value + ') tank ';
          reply += prefix + elementToString(element.currentLevel) + ', ' + elementToString(element.currentVolume) + '\n';
        });
        Object.values(app.getSelfPath('tanks.wasteWater')).forEach(element => {
          app.debug('Tank: ' + JSON.stringify(element));
          var prefix = elementName(element) + '(' + element.type.value + ') tank ';
          reply += prefix + elementToString(element.currentLevel) + ', ' + elementToString(element.currentVolume) + '\n';
        });
      } else
      if (text == 'solar') {
        const solar = app.getSelfPath('electrical.solar') || {};
        for (const [name, element] of Object.entries(solar)) {
          try {
            if (!element || typeof element !== 'object') {
              continue;
            }
            app.debug('Name: ' + name + ' element: ' + JSON.stringify(element));
            const parts = [];
            if (element.current) {
              parts.push(elementToString(element.current));
            }
            if (element.panelPower) {
              parts.push('power: ' + elementToString(element.panelPower, 'watt'));
            }
            if (element.panelVoltage) {
              parts.push(elementToString(element.panelVoltage));
            }
            const mode = element.chargingMode || element.trackerOperationMode;
            if (mode && typeof mode.value != 'undefined') {
              parts.push('charging mode: ' + mode.value);
            }
            if (element.yieldToday && typeof element.yieldToday.value == 'number') {
              parts.push('today: ' + (element.yieldToday.value / 3600).toFixed(0) + ' Wh');
            }
            reply += name + ': ' + parts.join(', ') + '\n';
          } catch (e) {
            app.debug('Solar error ' + name + ': ' + e);
          }
        }
      } else
      if (text == 'wind') {
          var windDirection
          var windType
          try {
            windDirection = app.getSelfPath('environment.wind.directionTrue')
            windType = 'direction True ground'
          }
          catch (e) {
            windDirection = app.getSelfPath('environment.wind.angleTrueWater')
            windType = 'angle True water'
          }
          finally {
            app.debug("Can't get wind angle")
          }
          
          windDirection['meta']['units'] = 'rad'
          var windSpeed = app.getSelfPath('environment.wind.speedOverGround')
          reply += 'Wind ' + windType + ': ' + elementToString(windDirection) + ', ' + elementToString(windSpeed) + '\n';
      } else
      if (text == 'depth') {
          reply += 'Depth: ' + elementToString(app.getSelfPath('environment.depth.belowTransducer')) + '\n';
      } else {
        reply += 'Use this chatId in SignalK: ' + chatId + '\n \
        Temp - Inside temperature\n \
        Tank - Tank information\n \
        Batt - battery states\n \
        Solar - Solar state\n \
        Wind - Wind information\n \
        Humidity - Humidity information\n \
        Depth - Depth information\n \
        Buddy - Nearby buddies\n \
        Starlink - Starlink status';
      }
      } catch (e) {
        app.error('Telegram command failed: ' + e);
        if (reply == '') {
          reply = 'Error handling ' + text;
        }
      }

      sendMessage(reply, text);
      //type other code here
    });
    bot.on('polling_error', (error) => {
      app.error('Polling error occurred:', error);
      if(error.code === 'ETIMEDOUT') {
        app.debug('Attempting to restart polling after timeout...');
        setTimeout(() => {
          bot.startPolling();
        }, 5000); // Wait for 5 seconds before attempting to restart
      } else {
        // Handle other types of errors
      }
    });
    app.setPluginStatus('Running');
  };



  function elementName (element) {
    if (typeof element.name != 'undefined') {
      let name = element.name.value;
      app.debug('name: ' + name);
      return (name + ' ');
    } else {
      return ('');
    };
  }

  function elementToString (object, type) {
    if (!object || typeof object.value == 'undefined') {
      return '';
    }
    app.debug('type: ' + type + ' object: ' + JSON.stringify(object));
    var units = type;
    if (typeof units == 'undefined' && object.meta && object.meta.units) {
      units = object.meta.units;
    }
    var value = object.value;
    if (typeof units == 'undefined' && (value == 0 || value == 1)) {
      units = 'bool'
    }
    app.debug('units: ' + units + ' value: ' + value);

    switch (units) {
      case 'K':
        return((value - 273.15).toFixed(1) + '°C');
        break
      case 'rad':
        return ((value * 57.2958).toFixed(0) + '°T');
        break
      case 'm/s':
        return ((value * 1.94384).toFixed(1) + 'kn');
          break
      case 'm':
        return((value).toFixed(1) + 'm')
        break
      case 'stateOfCharge':
        return ((value * 100).toFixed(0) + '%');
        break
     case 'ratio':
      return ((value * 100).toFixed(1) + '%');
      break
     case 'ration':
      return ((value * 100).toFixed(1) + '%');
      break
    case 'V':
      return (value.toFixed(1) + 'v');
      break
    case 'A':
      return (Number(value).toFixed(1) + 'A');
      break
    case 'm3':
      return ('liter: ' + (value  * 1000).toFixed(0));
      break
    case 'watt':
    case 'W':
      return (value + ' Watt');
      break
    case 'chargingMode':
      return ('charging mode: ' + value);
      break
    case 'bool':
      if ( value == 1) {
        return "on"
      } else if ( value == 0) {
        return "off"
      }
      break
    default:
      return (value);
    }
  }

  function listen(option) {
    let _notify = function(event) {
    sendMessage('[NOTIFICATION] ' + option.message);
    };

    app.on(option.event, _notify);
    unsubscribes.push(() => {
      app.removeListener(option.event, _notify);
    });
  }

  function addElement (ElementList, element) {
      let newList = Object.assign(ElementList, element)
      return newList
  }

  function sendMessage (message, text) {
    app.debug('Message: %s text: %s', message, text)
    if (message  == "") {
      message = ("No info for " + text)
    }
    chatids.forEach(chatid => {
      app.debug('Sending ' + chatid + ': ' + message);
      bot.sendMessage(chatid, message);
    });
  }

  plugin.stop = function() {
    if (bot) {
      bot.stopPolling()
        .then(() => {
          app.debug('Bot polling stopped');
        })
        .catch((err) => {
          app.error('Error stopping bot polling: ' + err);
        });
    }
    
    app.debug('Plugin stopped');
    unsubscribes.forEach(f => f());
    app.setPluginStatus('Stopped');
  };

  plugin.schema = {
    title: PLUGIN_NAME,
    type: 'object',
    properties: {
      bot: {
        type: 'object',
        required: ['token'],
        properties: {
          token: {
            type: 'string',
            title: 'Telegram Bot Token'
          }
        },
      },
      chatids: {
        type: 'array',
        title: 'Chat ids to receive messages',
        required: ['chatids'],
        items: {
          type: 'number',
          title: 'Chat id'
        }
      },
      notifications: {
        type: 'array',
        title: 'notifications',
        items: {
          type: 'object',
          properties: {
            event: {
              type: 'string',
              title: 'event'
            },
            message: {
              type: 'string',
              title: 'message'
            }
          }
        }
      }
    }

  };

  return plugin;
};
