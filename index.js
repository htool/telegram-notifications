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
          var message = u['values'][0]['value']['message'];
          app.debug('message: ' + message);
          var message = message.replace(/Your buddy /, '');
          app.debug('message: ' + message);
          sendMessage(message);
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
        var element;
        try {
          element = app.getSelfPath('environment.outside.temperature');
          app.debug('Temp: ' + JSON.stringify(element));
          reply += 'Outside ' + elementToString(element);
        } catch (e) {}
        try {
          element = app.getSelfPath('environment.inside.temperature');
          app.debug('Temp: ' + JSON.stringify(element));
          reply += ', inside ' + elementToString(element);
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
      if (text == 'Buddy') {
        const buddies = app.getSelfPath('notifications.buddy');
        if (typeof buddies != 'undefined') {
          Object.values(buddies).forEach(buddy => {
            reply += buddy.value.message.replace(/Your buddy /, '') + '\n';
          });
        } else {
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
      return((value - 273.15).toFixed(1) + '°C');
    }
    if (type == 'stateOfCharge') {
      return ((value * 100) + '%');
    }
    if (units == 'ratio') {
      return ((value * 100).toFixed(1) + '%');
    }
    if (units == 'V') {
      return (value.toFixed(1) + 'v');
    }
    if (units == 'A') {
      return (value + 'A');
    }
    if (units == 'm3') {
      return ('liter: ' + (value  * 1000).toFixed(0));
    }
    if (type == 'watt') {
      return (value + ' Watt');
    }
    if (type == 'chargingMode') {
      return ('charging mode: ' + value);
    }
    return (value);
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
