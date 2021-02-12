# Telegram notification plugin

This package is designed to send a Telegram notification when an event occurs on the server

## Configuration

The plugin has the following required options:

#### Token
The auth Token for your Telegram Bot account.
See how to set this up here: https://levelup.gitconnected.com/create-your-own-telegram-bot-and-send-and-receive-messages-via-nodejs-c0954928a8c4

For each notification the following settings are needed:

#### Event
The name of the event to subscribe to

#### Message
The message to send with the notifications

#### Recipients
A list of Telegram user to notify when this event occurs
