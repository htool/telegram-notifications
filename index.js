const TelegramBot = require('node-telegram-bot-api');
const PLUGIN_ID = 'telegram-notifications';
const PLUGIN_NAME = 'Telegram notifications';
var unsubscribes = [];
var bot;

module.exports = function(app) {
  var plugin = {};

  plugin.id = PLUGIN_ID;
  plugin.name = PLUGIN_NAME;
  plugin.description = 'A plugin to send telegram notifications when an event occurs';

  plugin.start = function(options, restartPlugin) {
    app.debug('Plugin started');
    plugin.options = options;

    let token = options.bot.token;
    // Create a bot that uses 'polling' to fetch new updates
    bot = new TelegramBot(token, {polling: true});

    app.debug('Options: ' + JSON.stringify(options));

    options.notifications.forEach(option => listen(option));

    bot.on('message', (msg) => {
      let chatId = msg.chat.id;
      let text = msg.text;
      app.debug('Message: ' + JSON.stringify(msg));
      app.debug('Options: ' + JSON.stringify(options));

      var reply = '';

      if (text == 'Temp') {
        var element = app.getSelfPath('environment.inside.temperature');
        app.debug('Temp: ' + JSON.stringify(element));
        var prefix = 'Inside ';
        reply += prefix + elementToString(element) + '\n';
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
        reply += 'Use this chatId in SignalK: ' + chatId + '\nTemp - Inside temperature\nTank - Tank information\nBatt - battery states\nSolar - Solar state' + '\n';
      }

      bot.sendMessage(chatId, reply);
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
      return (': ' + (value * 100) + '%');
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
    app.debug(option.recipients + ' ' + option.message)
    bot.sendMessage(option.recipients, '[NOTIFICATION] ' + option.message);
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
            },
            recipients: {
              type: 'number',
              title: 'Chat id'
            }
          }
        }
      }
    }

  };

  return plugin;
};
