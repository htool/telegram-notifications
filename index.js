const TelegramBot = require('node-telegram-bot-api');
const geolib = require('geolib');
const PLUGIN_ID = 'telegram-notifications';
const PLUGIN_NAME = 'Telegram notifications';
var unsubscribes = [];
var bot;
var chatids;

module.exports = function(app) {
  var plugin = {};

  plugin.id = PLUGIN_ID;
  plugin.name = PLUGIN_NAME;
  plugin.description = 'A plugin to send telegram notifications when an event occurs';

  String.prototype.capitalize = function() {
      return this.charAt(0).toUpperCase() + this.slice(1).toLowerCase();
  }

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
          var vessel = 'vessels.' + u['values'][0]['path'].replace(/^notifications.buddy./, '');
          var buddy = app.getPath(vessel);
          var message = '';
          if (typeof buddy != 'undefined') {
            if (typeof buddy.name != 'undefined') {
              name = buddy.name.capitalize();
              app.debug('Name: ' + name);
              message += name;
              if (typeof buddy.navigation.destination != 'undefined') {
                harbour = buddy.navigation.destination.commonName.value.name.capitalize();
                message += ' (' + harbour + ')';
              }
              message += ' is near';
            }
            if (typeof buddy.navigation.position != 'undefined') {
              const myPos = app.getSelfPath('navigation.position.value');
              app.debug('myPos: ' + JSON.stringify(myPos));
              var position = buddy.navigation.position.value;
              app.debug('position: ' + JSON.stringify(position));
              if ( myPos && myPos.latitude && myPos.longitude ) {
                  const distance = geolib.getDistance(myPos, position);
                  message += ' (' + distance + 'm)';
              }
            }
            sendMessage(message);
          } else {
            app.debug('Unknown vessel')
          }
        });
      }
    );

    bot.on('message', (msg) => {
      let chatId = msg.chat.id;
      globalChatId = chatId;
      let text = msg.text;
      app.debug('Message: ' + JSON.stringify(msg));
      app.debug('Options: ' + JSON.stringify(options));
      var reply = '';

      if (text == 'Temp') {
        var element = app.getSelfPath('environment.inside.temperature');
        app.debug('Temp: ' + JSON.stringify(element));
        reply += 'Inside ' + elementToString(element);
        element = app.getSelfPath('environment.water.temperature');
        app.debug('Temp: ' + JSON.stringify(element));
        reply += ', water ' + elementToString(element);
      } else
      if (text == 'Buddy') {
        const buddies = app.getSelfPath('notifications.buddy');

        if (typeof buddies != 'undefined') {
          for (const [path, element] of Object.entries(app.getSelfPath('notifications.buddy'))) {
            var buddy = app.getPath('vessels.' + path);
            app.debug('buddy: ' + JSON.stringify(buddy));
            if (typeof buddy != 'undefined' && buddy.buddy == true) {
              const myPos = app.getSelfPath('navigation.position.value');
              app.debug('myPos: ' + JSON.stringify(myPos));
              var position = buddy.navigation.position.value;
              app.debug('position: ' + JSON.stringify(position));
              if (typeof buddy.name != 'undefined') {
                reply += buddy.name.capitalize();
                if (typeof buddy.navigation.destination != 'undefined') {
                  harbour = buddy.navigation.destination.commonName.value.name.capitalize();
                  reply += ' (' + harbour + ')';
                }
                reply += ' is near';
                if ( myPos && myPos.latitude && myPos.longitude ) {
                  const distance = geolib.getDistance(myPos, position);
                  reply += ' (' + distance + 'm)';
                }
                reply += '\n';
              }
            }
          }
        }
        if (reply == '') {
          reply += 'No buddies nearby\n';
        }
      } else
      if (text == 'Batt') {
        Object.values(app.getSelfPath('electrical.batteries')).forEach(element => {
          app.debug('Batt: ' + JSON.stringify(element));
          var prefix = elementName(element) + 'battery ';
          reply += prefix + elementToString(element.stateOfCharge, 'stateOfCharge') + ', ' + elementToString(element.voltage) + '\n';
        });
      } else
      if (text == 'Tank') {
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
      } else
      if (text == 'Solar') {
        for (const [name, element] of Object.entries(app.getSelfPath('electrical.solar'))) {
        //Object.values(app.getSelfPath('electrical.solar')).forEach(element => {
          app.debug('Solar: ' + JSON.stringify(element));
          reply += name + ': ' + elementToString(element.current) + ', power: ' + element.panelPower.value + ' Watt, charging mode: ' + element.chargingMode.value + '\n';
        }
      } else {
        reply += 'Use this chatId in SignalK: ' + chatId + '\n \
        Temp - Inside temperature\n \
        Tank - Tank information\n \
        Batt - battery states\n \
        Solar - Solar state\n \
        Buddy - Nearby buddies';
      }

      sendMessage(reply);
      //type other code here
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
    app.debug('type: ' + type + ' object: ' + JSON.stringify(object));
    var units = object.meta.units;
    var value = object.value;
    app.debug('units: ' + units + ' value: ' + value);

    if (units == 'K') {
      return('temperature: ' + (value - 273.15).toFixed(1) + '°C');
    }
    if (type == 'stateOfCharge') {
      return ('charge level: ' + (value * 100) + '%');
    }
    if (units == 'ratio') {
      return (': ' + (value * 100).toFixed(1) + '%');
    }
    if (units == 'V') {
      return ('voltage: ' + value.toFixed(1) + 'v');
    }
    if (units == 'A') {
      return ('current: ' + value + 'A');
    }
    if (units == 'm3') {
      return ('liter: ' + (value  * 1000).toFixed(0));
    }
    if (type == 'watt') {
      return ('power: ' + value + ' Watt');
    }
    if (type == 'chargingMode') {
      return ('charging mode: ' + value);
    }
    return ('');
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

  function sendMessage (message) {
    chatids.forEach(chatid => {
      app.debug('Sending ' + chatid + ': ' + message);
      bot.sendMessage(chatid, message);
    });
  }

  plugin.stop = function() {
    // Here we put logic we need when the plugin stops
    //bot.close();
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
