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
        bot.sendMessage(chatId, PathToString('environment.inside.temperature'));
      } else
      if (text == 'Batt') {
        Object.values(app.getSelfPath('electrical.batteries')).forEach(element => {
          app.debug('Value: ' + element);
          var prefix = pathName(element) + 'battery ';
          bot.sendMessage(chatId, prefix + PathToString(element + '.stateOfCharge'));
          bot.sendMessage(chatId, prefix + PathToString(element + '.voltage'));
        });
      } else
      if (text == 'Solar') {
        Object.values(app.getSelfPath('electrical.solar')).forEach(element => {
          app.debug('Value: ' + element);
          var prefix = pathName(element) + ' ';
          bot.sendMessage(chatId, prefix + PathToString(element + '.panelPower'));
          bot.sendMessage(chatId, prefix + PathToString(element + '.current'));
          bot.sendMessage(chatId, prefix + PathToString(element + '.chargingMode'));
        });
      } else {
        bot.sendMessage(chatId, 'Use this chatId in SignalK: ' + chatId + '\nTemp - Kajuit temperature\nBatt - battery state');
      }

      //type other code here
    });


    app.setPluginStatus('Running');


  };

  function pathName (path) {
    var name = app.getSelfPath(path + '.name').value;
    if (typeof name == 'string') {
    app.debug('name: ' + name);
      return (name + ' ');
    } else {
      return ('');
    };
  }

  function RemoveLastPath(path)
  {
      var the_arr = path.split('.');
      the_arr.pop();
      return(the_arr.join('.'));
  }

  function PathToString (path) {
    pathObject = app.getSelfPath(path);
    app.debug('pathObject: ' + pathObject);
    var unit = pathObject.unit;
    var value = pathObject.value;
    var returnValue;


    if (unit == 'Kelvin') {
      returnValue += 'temperature: ' + (value - 273.15).toFixed(1) + '°C';
    }
    if (path.endsWith('stateOfCharge')) {
      returnValue += 'battery charge level: ' + (value * 100) + '%';
    }
    if (unit == 'V') {
      returnValue += 'battery voltage: ' + value + 'v';
    }
    if (unit == 'A') {
      returnValue += 'current: ' + value + 'A';
    }
    if (path.endsWith('panelPower')) {
      returnValue += 'power: ' + value + ' Watt';
    }
    if (path.endsWith('chargingMode')) {
      returnValue += 'charging mode: ' + value;
    }

    return returnValue;
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