const async = require('async');
const chromeLauncher = require('lighthouse/chrome-launcher/chrome-launcher');
const CDP = require('chrome-remote-interface');

module.exports = function(opts, callback) {
  if (!opts || !opts.url) {
    throw Error('URL is required');
  }

  opts.retries = opts.retries || 5;
  opts.retryTimeout = opts.retryTimeout || 2000;
  let chrome;
  let protocol;

  async.waterfall([
    (callback) => {
      chromeLauncher.launch({
        port: opts.port || 9222,
        chromeFlags: [
          `--window-size=${opts.width || 640},${opts.height || 640}`,
          '--disable-gpu',
          '--headless'
        ],
      }).then((chrome) => {
        return callback(null, chrome);
      });
    },
    (ch, callback) => {
      chrome = ch;
      CDP({ port: chrome.port }).then((protocol) => {
        return callback(null, protocol);
      });
    },
    (pr, callback) => {
      protocol = pr;
      const { Page, Runtime } = protocol;
      Promise.all([ Page.enable(), Runtime.enable() ]).then(() => {
        return callback(null);
      });
    },
    (callback) => {
      const { Page, Runtime } = protocol;
      Page.navigate({ url: opts.url });
      Page.loadEventFired(() => callback(null));
    },
    (callback) => {
      const { Page, Runtime } = protocol;

      function evaluate(expression, callback) {
        Runtime.evaluate({ expression }).then((result) => {
          return callback(result.result.value);
        });
      }

      function destroy() {
        protocol.close();
        chrome.kill();
      }

      let retries = 0;
      function loop() {
        let renderable;
        evaluate('window.renderable', (renderable) => {
          // Save screenshot if renderable is true or renderable isn't set
          if (renderable === undefined || renderable) {
            Page.captureScreenshot().then((data) => {
              destroy();
              return callback(null, data ? data.data : null);
            });
          } else {
            retries++;
            if (retries >= opts.retries) {
              destroy();
              return callback(`Unable to parse page after ${opts.retries} retries`);
            }

            setTimeout(loop, opts.retryTimeout);
          }
        });
      }

      loop();
    }
  ], callback);
};