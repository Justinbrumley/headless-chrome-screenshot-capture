const chromeLauncher = require('lighthouse/chrome-launcher/chrome-launcher');
const CDP = require('chrome-remote-interface');

module.exports = function(opts) {
  return new Promise(async (resolve) => {
    if (!opts || !opts.url) {
      throw Error('URL is required');
    }

    opts.retries = opts.retries || 5;
    opts.retryTimeout = opts.retryTimeout || 2000;

    async function launchChrome() {
      return await chromeLauncher.launch({
        port: opts.port || 9222,
        chromeFlags: [
          `--window-size=${opts.width || 640},${opts.height || 640}`,
          '--disable-gpu',
          '--headless'
        ],
      });
    }

    const chrome = await launchChrome();
    const protocol = await CDP({ port: chrome.port });

    const { Page, Runtime } = protocol;
    await Promise.all([ Page.enable(), Runtime.enable() ]);

    console.log('Opening url...', opts.url);
    Page.navigate({ url: opts.url });

    await Page.loadEventFired();

    async function evaluate(expression) {
      const result = await Runtime.evaluate({ expression });
      return result.result.value;
    }

    function destroy() {
      protocol.close();
      chrome.kill();
    }

    let retries = 0;
    async function loop() {
      let renderable;
      try {
        renderable = await evaluate('window.renderable');
      } catch(e) {
        throw Error('Error checking renderable value:', e);
      }

      // Save screenshot if renderable is true or renderable isn't set
      if (renderable === undefined || renderable) {
        Page.captureScreenshot().then((data) => {
          destroy();
          resolve(data.data);
        });
      } else {
        retries++;
        if (retries >= opts.retries) {
          destroy();
          throw Error(`Unable to parse page after ${opts.retries} retries`);
        }

        setTimeout(async () => {
          await loop();
        }, opts.retryTimeout);
      }
    }

    await loop();
  });
};