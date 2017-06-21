const chromeLauncher = require('lighthouse/chrome-launcher/chrome-launcher');
const CDP = require('chrome-remote-interface');

async function launchChrome(headless = true) {
  return await chromeLauncher.launch({
    port: 9222,
    chromeFlags: [
      '--window-size=412,732',
      '--disable-gpu',
      headless ? '--headless' : ''
    ],
  });
}

(async function() {
  const chrome = await launchChrome(true);
  const protocol = await CDP({ port: chrome.port });

  const { Page, Runtime } = protocol;
  await Promise.all([ Page.enable(), Runtime.enable() ]);

  console.log('Opening url...');
  Page.navigate({ url: 'http://dev.sumo.com/apps/listbuilder/v3/template/06977c14-2f9c-41b9-831c-5b6992ca397f/phantom' });

  Page.loadEventFired(async () => {
    console.log('Load event fired...');
    async function evaluate() {
      const result = await Runtime.evaluate({ expression: 'window.renderable' });
      return result.result.value;
    }

    async function loop() {
      let renderable;
      try {
        renderable = await evaluate('window.renderable');
      } catch(e) {
        console.log('Error checking renderable value:', e);
      }

      console.log('Renderable:', renderable);

      // Save screenshot if renderable is true or renderable isn't set
      if (renderable === undefined || renderable) {
        let image;
        try {
          image = await Page.captureScreenshot();
        } catch(e) {
          console.log('Error capturing screenshot:', e);
        }

        console.log('Image:', image);

        protocol.close();
        chrome.kill();
      } else {
        setTimeout(async () => {
          await loop();
        }, 500);
      }
    }

    await loop();
  });
})();