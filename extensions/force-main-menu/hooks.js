'use strict';

const fs = require('fs');
const path = require('path');

const MAIN_MENU_UUID = '0962fd54-dc49-4512-b630-f0c3743d4bee';
const MAIN_MENU_SCENE = 'db://assets/scenes/MainMenu.scene';

exports.throwError = true;

function forceStartSceneOption(options) {
  if (!options) {
    return;
  }
  options.startScene = MAIN_MENU_UUID;
}

function forceSettingsObject(settings) {
  if (!settings) {
    return;
  }
  if (!settings.launch) {
    settings.launch = {};
  }
  settings.launch.launchScene = MAIN_MENU_SCENE;
}

function forceSettingsFile(settingsPath) {
  if (!settingsPath || !fs.existsSync(settingsPath)) {
    return false;
  }
  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  forceSettingsObject(settings);
  fs.writeFileSync(settingsPath, JSON.stringify(settings), 'utf8');
  return true;
}

function getSettingsPath(result) {
  if (result && result.paths && result.paths.settings) {
    return result.paths.settings;
  }
  if (result && result.dest) {
    return path.join(result.dest, 'src', 'settings.json');
  }
  return '';
}

exports.onBeforeBuild = function onBeforeBuild(options) {
  forceStartSceneOption(options);
};

exports.onAfterCompressSettings = function onAfterCompressSettings(options, result) {
  forceStartSceneOption(options);
  forceSettingsObject(result && result.settings);
};

exports.onAfterBuild = function onAfterBuild(options, result) {
  forceStartSceneOption(options);
  forceSettingsObject(result && result.settings);
  const settingsPath = getSettingsPath(result);
  if (forceSettingsFile(settingsPath)) {
    console.log(`[force-main-menu] launchScene -> ${MAIN_MENU_SCENE}`);
  }
};
