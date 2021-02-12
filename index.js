const TelegramBot = require('node-telegram-bot-api');
const PLUGIN_ID = 'telegram-notifications';
const PLUGIN_NAME = 'Telegram notifications';
var unsubscribes = [];

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
    const bot = new TelegramBot(token, {polling: true});

    app.debug('Options: ' + JSON.stringify(options));

    options.notifications.forEach(option => listen(option));

    bot.on('message', (msg) => {
      let chatId = msg.chat.id;
      let text = msg.text;
      app.debug('Message: ' + JSON.stringify(msg));
      app.debug('Options: ' + JSON.stringify(options));

      if (text == 'Temp') {
        var element = app.getSelfPath('environment.inside.temperature');
        app.debug('Value: ' + JSON.stringify(element));
        var prefix = 'Inside ';
        bot.sendMessage(chatId, prefix + elementToString(element));
      } else
      if (text == 'Batt') {
        Object.values(app.getSelfPath('electrical.batteries')).forEach(element => {
          app.debug('Value: ' + JSON.stringify(element));
          var prefix = elementName(element) + 'battery ';
          bot.sendMessage(chatId, prefix + elementToString(element.stateOfCharge, 'stateOfCharge') + ', ' + elementToString(element.voltage));
        });
      } else
      if (text == 'Solar') {
        Object.values(app.getSelfPath('electrical.solar')).forEach(element => {
          app.debug('Value: ' + JSON.stringify(element));
          var prefix = elementName(element) + 'Solar ';
          bot.sendMessage(chatId, prefix + elementToString(element.current) + ', power: ' + element.panelPower.value + ' Watt, charging mode: ' + element.chargingMode.value);
        });
      } else {
        bot.sendMessage(chatId, 'Use this chatId in SignalK: ' + chatId + '\nTemp - Inside temperature\nBatt - battery states\nSolar - Solar state');
      }

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
    if (units == 'V') {
      return ('voltage: ' + value.toFixed(1) + 'v');
    }
    if (units == 'A') {
      return ('current: ' + value + 'A');
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
      option.recipients.forEach(recipient => {
        bot.sendMessage(chatId, option.message);
        app.debug(chatId + ' ' + option.message)
      });
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
    // let token = options.bot.token;
    // const bot = new TelegramBot(token);
    // bot.stopPolling();
    // bot.close();
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
              type: 'string',
              title: 'Chat id'
            }
          }
        }
      }
    }

  };

  return plugin;
};
