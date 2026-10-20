process.env.NTBA_FIX_319 = 1 // or require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api')
const geolib = require('geolib')
const PLUGIN_ID = 'telegram-notifications'
const PLUGIN_NAME = 'Telegram notifications'
var unsubscribes = []
var bot
var chatids
var isBotPolling = false // To track if the bot is currently polling
var reconnecting = false // New variable to track if we're currently reconnecting

var buddiesState = {}

module.exports = function (app) {
  var plugin = {}

  plugin.id = PLUGIN_ID
  plugin.name = PLUGIN_NAME
  plugin.description =
    'A plugin to send telegram notifications when an event occurs'

  plugin.start = function (options, restartPlugin) {
    plugin.options = options
    chatids = options.chatids
    app.debug('Plugin started. Using chatids: ' + chatids.join(','))
    let token = options.bot.token
    // Create a bot that uses 'polling' to fetch new updates
    bot = new TelegramBot(token, { polling: true })
    // app.debug('Options: ' + JSON.stringify(options));
    options.notifications.forEach(option => listen(option))
    // Add a connection check every 60 seconds
    setInterval(checkTelegramConnection, 60000)
    setInterval(restartConnection, 30000)

    let localSubscription = {
      context: 'vessels.self', // Get data for all contexts
      subscribe: [
        {
          path: options.notificationPath || 'notifications.buddy.*', // configurable
          policy: 'instant'
        }
      ]
    }

    app.subscriptionmanager.subscribe(
      localSubscription,
      unsubscribes,
      subscriptionError => {
        app.error('Error:' + subscriptionError)
      },
      delta => {
        const stateFilter = options.stateFilter && options.stateFilter.length
          ? options.stateFilter : ['alert', 'warn', 'alarm', 'emergency']
        delta.updates.forEach(u => {
          (u.values || []).forEach(v => {
            const path = v.path
            const value = v.value || {}
            const state = value.state
            const prev = buddiesState[path]
            buddiesState[path] = state
            // only send on a state change into a filtered state
            if (!stateFilter.includes(state)) return
            if (prev === state) {
              app.debug('Duplicate state %s for %s', state, path)
              return
            }
            const message = String(value.message || path).replace(/Your buddy /, '')
            sendMessage(message)
          })
        })
      }
    )

    bot.on('message', msg => {
      let chatId = msg.chat.id
      chatids = [chatId]

      globalChatId = chatId
      let text = msg.text.toLowerCase()
      app.debug('Message: ' + JSON.stringify(msg))
      app.debug('Options: ' + JSON.stringify(options))
      var reply = ''

      try {
      if (text == 'temp') {
        var element
        try {
          element = app.getSelfPath('environment.outside.temperature')
          app.debug('Temp: ' + JSON.stringify(element))
          reply += 'buiten ' + elementToString(element) + ', '
        } catch (e) {}
        try {
          element = app.getSelfPath(
            'environment.inside.hutachterstuurboord.temperature'
          )
          app.debug('Temp: ' + JSON.stringify(element))
          reply += 'hut stuurboord ' + elementToString(element) + ', '
        } catch (e) {}
        try {
          element = app.getSelfPath(
            'environment.inside.hutachterbakboord.temperature'
          )
          app.debug('Temp: ' + JSON.stringify(element))
          reply += 'hut bakboord ' + elementToString(element) + ', '
        } catch (e) {}
        try {
          element = app.getSelfPath('environment.inside.hutvoor.temperature')
          app.debug('Temp: ' + JSON.stringify(element))
          reply += 'hut voor ' + elementToString(element) + ', '
        } catch (e) {}
        try {
          element = app.getSelfPath('environment.inside.fridge.temperature')
          app.debug('Temp: ' + JSON.stringify(element))
          reply += 'koelkast ' + elementToString(element) + ', '
        } catch (e) {}
        try {
          element = app.getSelfPath('environment.water.temperature')
          app.debug('Temp: ' + JSON.stringify(element))
          reply += 'water ' + elementToString(element)
        } catch (e) {}
      } else if (text == 'humidity') {
        var element
        try {
          element = app.getSelfPath('environment.outside.humidity')
          app.debug('Humidity: ' + JSON.stringify(element))
          reply += 'buiten ' + elementToString(element) + ', '
        } catch (e) {}
        try {
          element = app.getSelfPath('environment.inside.fridge.humidity')
          app.debug('Humidity: ' + JSON.stringify(element))
          reply += 'koelkast ' + elementToString(element) + ', '
        } catch (e) {}
        try {
          element = app.getSelfPath('environment.inside.hutvoor.humidity')
          app.debug('Humidity: ' + JSON.stringify(element))
          reply += 'hut voor ' + elementToString(element) + ', '
        } catch (e) {}
        try {
          element = app.getSelfPath(
            'environment.inside.hutachterbakboord.humidity'
          )
          app.debug('Humidity: ' + JSON.stringify(element))
          reply += 'hut bakboord ' + elementToString(element) + ', '
        } catch (e) {}
        try {
          element = app.getSelfPath(
            'environment.inside.hutachterstuurboord.humidity'
          )
          app.debug('Humidity: ' + JSON.stringify(element))
          reply += 'hut stuurboord ' + elementToString(element)
        } catch (e) {}
      } else if (text == 'buddy') {
        const buddies = app.getSelfPath('notifications.buddy')
        if (typeof buddies != 'undefined') {
          Object.values(buddies).forEach(buddy => {
            reply += buddy.value.message.replace(/Your buddy /, '') + '\n'
          })
        } else {
          reply += 'No buddies nearby\n'
        }
      } else if (text == 'starlink') {
        element = app.getSelfPath('electrical.switches.starlink.state')
        app.debug('Starlink: ' + JSON.stringify(element))
        onoff = elementToString(element)
        reply += 'Starlink power: ' + onoff
        if (onoff == 'on') {
          element = app.getSelfPath('network.providers.starlink.status')
          app.debug('Starlink network status: ' + JSON.stringify(element))
        }
      } else if (text == 'batt') {
        const batteries = app.getSelfPath('electrical.batteries') || {}
        for (const [id, element] of Object.entries(batteries)) {
          try {
            if (
              !element ||
              typeof element !== 'object' ||
              !element.voltage ||
              typeof element.name == 'undefined'
            ) {
              continue
            }
            app.debug('Batt: ' + JSON.stringify(element))
            var prefix = elementName(element) || id + ' '
            prefix += 'battery '
            const soc = element.capacity && element.capacity.stateOfCharge
            if (typeof soc != 'undefined') {
              reply +=
                prefix +
                elementToString(soc, 'stateOfCharge') +
                ', ' +
                elementToString(element.voltage)
            } else {
              reply += prefix + elementToString(element.voltage)
            }
            if (element.current) {
              reply += ', ' + elementToString(element.current)
            }
            reply += '\n'
          } catch (e) {
            app.debug('Batt error ' + id + ': ' + e)
          }
        }
      } else if (text == 'tank') {
        ['freshWater', 'fuel', 'wasteWater'].forEach(type => {
          Object.values(app.getSelfPath(`tanks.${type}`)).forEach(element => {
            app.debug('Tank: ' + JSON.stringify(element));
            const prefix = elementName(element) + '(' + element.type.value + ') tank ';
            reply += prefix + 
            elementToString(element.currentLevel, 'ratio') + ', ' + 
            elementToString(element.currentVolume, 'm3') + '\n';
          });
        });
      } else if (text == 'solar') {
        const solar = app.getSelfPath('electrical.solar') || {}
        for (const [name, element] of Object.entries(solar)) {
          try {
            if (!element || typeof element !== 'object') {
              continue
            }
            app.debug('Name: ' + name + ' element: ' + JSON.stringify(element))
            const parts = []
            if (element.current) {
              parts.push(elementToString(element.current))
            }
            if (element.panelPower) {
              parts.push('power: ' + elementToString(element.panelPower, 'watt'))
            }
            if (element.panelVoltage) {
              parts.push(elementToString(element.panelVoltage))
            }
            const mode = element.chargingMode || element.trackerOperationMode
            if (mode && typeof mode.value != 'undefined') {
              parts.push('charging mode: ' + mode.value)
            }
            if (element.yieldToday && typeof element.yieldToday.value == 'number') {
              parts.push(
                'today: ' + (element.yieldToday.value / 3600).toFixed(0) + ' Wh'
              )
            }
            reply += name + ': ' + parts.join(', ') + '\n'
          } catch (e) {
            app.debug('Solar error ' + name + ': ' + e)
          }
        }
      } else if (text == 'wind') {
        var windDirection
        var windType
        try {
          windDirection = app.getSelfPath('environment.wind.directionTrue')
          windType = 'direction True ground'
        } catch (e) {
          windDirection = app.getSelfPath('environment.wind.angleTrueWater')
          windType = 'angle True water'
        } finally {
          app.debug("Can't get wind angle")
        }

        windDirection['meta']['units'] = 'rad'
        var windSpeed = app.getSelfPath('environment.wind.speedOverGround')
        reply +=
          'Wind ' +
          windType +
          ': ' +
          elementToString(windDirection) +
          ', ' +
          elementToString(windSpeed) +
          '\n'
      } else if (text == 'depth') {
        reply +=
          'Depth: ' +
          elementToString(
            app.getSelfPath('environment.depth.belowTransducer')
          ) +
          '\n'
      } else {
        reply +=
          'Use this chatId in SignalK: ' +
          chatId +
          '\n \
        Temp - Inside temperature\n \
        Tank - Tank information\n \
        Batt - battery states\n \
        Solar - Solar state\n \
        Wind - Wind information\n \
        Humidity - Humidity information\n \
        Depth - Depth information\n \
        Buddy - Nearby buddies\n \
        Starlink - Starlink status'
      }
      } catch (e) {
        app.error('Telegram command failed: ' + e)
        if (reply == '') {
          reply = 'Error handling ' + text
        }
      }

      sendMessage(reply, text)
      //type other code here
    })
    bot.on('polling_error', error => {
      if (isBotPolling) {
        app.error('Polling error occurred:', error)
        app.setPluginStatus('Polling error')
        app.debug('Attempting to restart polling after timeout...')
        isBotPolling = false
        setTimeout(() => {
          bot.startPolling()
        }, 60000) // Wait for 60 seconds before attempting to restart
      }
    })
    app.setPluginStatus('Running')
  }

  function restartConnection () {
    isBotPolling = false
    bot
      .stopPolling()
      .then(() => {
        app.debug('Attempting to restart bot polling...')
        setTimeout(() => {
          bot
            .stopPolling()
            .then(() => {
              app.debug('Previous bot polling stopped. Starting new session.')
              bot.startPolling()
            })
            .catch(err => {
              app.error('Error stopping current bot polling:', err)
              app.debug("Restarting with 'restart: true'")
              bot.startPolling({ restart: true })
            })
          isBotPolling = true
        }, 5000) // Wait for 5 seconds before restarting
      })
      .catch(reconnectError => {
        app.error('Failed to restart polling:', reconnectError)
      })
  }

  function checkTelegramConnection () {
    if (!isBotPolling) {
      // We assume if not polling, we might need to check or restart
      bot
        .getMe()
        .then(info => {
          app.debug('Bot connection check: Bot is active.')
          // If we thought we weren't polling but this succeeds, bot might have recovered or was misidentified
          isBotPolling = true
        })
        .catch(error => {
          app.error('Bot connection check failed:', error)
          // Here you might want to attempt to restart the bot or handle the error
          bot
            .stopPolling()
            .then(() => {
              app.debug(
                'Attempting to restart bot polling after connection check failure...'
              )
              setTimeout(() => {
                bot
                  .stopPolling()
                  .then(() => {
                    app.debug(
                      'Previous bot polling stopped. Starting new session.'
                    )
                    bot.startPolling()
                  })
                  .catch(err => {
                    app.error('Error stopping current bot polling:', err)
                    app.debug("Restarting with 'restart: true'")
                    bot.startPolling({ restart: true })
                  })
                isBotPolling = true
              }, 5000) // Wait for 5 seconds before restarting
            })
            .catch(reconnectError => {
              app.error('Failed to restart polling:', reconnectError)
            })
        })
    } else {
      app.debug(
        'Bot connection check: Currently polling, connection assumed active.'
      )
    }
  }

  function elementName (element) {
    if (typeof element.name != 'undefined') {
      let name = element.name.value
      app.debug('name: ' + name)
      return name + ' '
    } else {
      return ''
    }
  }

  function elementToString (object, type) {
    if (!object || typeof object.value == 'undefined') {
      return ''
    }
    app.debug('type: ' + type + ' object: ' + JSON.stringify(object))
    var units = type
    if (typeof units == 'undefined' && object.meta && object.meta.units) {
      units = object.meta.units
    }
    var value = object.value
    if (typeof units == 'undefined' && (value == 0 || value == 1)) {
      units = 'bool'
    }
    app.debug('units: ' + units + ' value: ' + value)

    switch (units) {
      case 'K':
        return (value - 273.15).toFixed(1) + '°C'
        break
      case 'rad':
        return (value * 57.2958).toFixed(0) + '°T'
        break
      case 'm/s':
        return (value * 1.94384).toFixed(1) + 'kn'
        break
      case 'm':
        return value.toFixed(1) + 'm'
        break
      case 'stateOfCharge':
        return (value * 100).toFixed(0) + '%'
        break
      case 'ratio':
        return (value * 100).toFixed(1) + '%'
        break
      case 'ration':
        return (value * 100).toFixed(1) + '%'
        break
      case 'V':
        return value.toFixed(1) + 'v'
        break
      case 'A':
        return Number(value).toFixed(1) + 'A'
        break
      case 'm3':
        return 'liter: ' + (value * 1000).toFixed(0)
        break
      case 'watt':
      case 'W':
        return value + ' Watt'
        break
      case 'chargingMode':
        return 'charging mode: ' + value
        break
      case 'bool':
        if (value == 1) {
          return 'on'
        } else if (value == 0) {
          return 'off'
        }
        break
      default:
        return value
    }
  }

  function listen (option) {
    let _notify = function (event) {
      sendMessage('[NOTIFICATION] ' + option.message)
    }

    app.on(option.event, _notify)
    unsubscribes.push(() => {
      app.removeListener(option.event, _notify)
    })
  }

  function addElement (ElementList, element) {
    let newList = Object.assign(ElementList, element)
    return newList
  }

  function sendMessage (message, text) {
    app.debug('Message: %s text: %s', message, text)
    if (message == '') {
      message = 'No info for ' + text
    }
    chatids.forEach(chatid => {
      app.debug('Sending ' + chatid + ': ' + message)
      bot.sendMessage(chatid, message)
    })
  }

  plugin.stop = function () {
    if (bot) {
      bot
        .stopPolling()
        .then(() => {
          app.debug('Bot polling stopped')
        })
        .catch(err => {
          app.error('Error stopping bot polling: ' + err)
        })
    }
    bot
      .stopPolling()
      .then(() => {
        console.log('Bot polling stopped')
      })
      .catch(err => console.error('Error stopping bot:', err))
    unsubscribes.forEach(f => f())
    app.setPluginStatus('Stopped')
    app.debug('Plugin stopped')
  }

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
      chatids: {
        type: 'array',
        title: 'Chat ids to receive messages',
        required: ['chatids'],
        items: {
          type: 'number',
          title: 'Chat id'
        }
      },
      notificationPath: {
        type: 'string',
        title: 'Signal K notification path pattern to forward',
        default: 'notifications.buddy.*'
      },
      stateFilter: {
        type: 'array',
        title: 'Forward only these notification states (sent on change into state)',
        uniqueItems: true,
        items: { type: 'string', enum: ['nominal', 'normal', 'alert', 'warn', 'alarm', 'emergency'] },
        default: ['alert', 'warn', 'alarm', 'emergency']
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
  }

  return plugin
}
