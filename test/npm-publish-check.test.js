'use strict'

const { test } = require('node:test')
const assert = require('node:assert/strict')
const {
  isPublishablePath,
  nextPublishVersion,
  shouldPublish
} = require('../scripts/npm-publish-check.js')

test('index.js is publishable; tests and docs are not', () => {
  assert.equal(isPublishablePath('index.js'), true)
  assert.equal(isPublishablePath('test/plugin.test.js'), false)
  assert.equal(isPublishablePath('README.md'), false)
})

test('nextPublishVersion uses local when already ahead of npm', () => {
  assert.equal(nextPublishVersion('0.1.1', '0.1.0'), '0.1.1')
  assert.equal(nextPublishVersion('0.1.1', '0.1.1'), '0.1.2')
  assert.equal(nextPublishVersion('0.1.0', '0.1.0'), '0.1.1')
})

test('shouldPublish when index.js changed and not already today', () => {
  const d = shouldPublish({
    lastPublishTime: '2026-09-10T15:00:00.000Z',
    now: new Date('2026-09-15T14:00:00.000Z'),
    changedFiles: ['index.js', 'README.md']
  })
  assert.equal(d.publish, true)
  assert.deepEqual(d.files, ['index.js'])
})

test('decide skips first publish when the package is missing on npm', () => {
  const { decide } = require('../scripts/npm-publish-check.js')
  const err = new Error('not in this registry')
  err.code = 'NPM_MISSING'
  const d = decide({
    localVersion: '1.0.2',
    npmView: function () {
      throw err
    }
  })
  assert.equal(d.publish, false)
  assert.match(d.reason, /not on registry/)
  assert.equal(d.nextVersion, '1.0.2')
})
