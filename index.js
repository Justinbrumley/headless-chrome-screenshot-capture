const chromeLauncher = require('lighthouse/chrome-launcher/chrome-launcher');
const CDP = require('chrome-remote-interface');

async function launchChrome(headless = true) {
  return await chromeLauncher.launch({
    port: 9222,
    flags: [
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

  Page.navigate({ url: 'http://dev.sumo.com/apps/listbuilder/v3/template/06977c14-2f9c-41b9-831c-5b6992ca397f/phantom' });

  Page.loadEventFired(async () => {
    async function evaluate() {
      const result = await Runtime.evaluate({ expressions: 'window.renderable' });
      return result.result.value;
    }

    const renderable = await evaluate('window.renderable');

    console.log('Page renderable?', renderable);
    protocol.close();
    chrome.kill();
  });
})();