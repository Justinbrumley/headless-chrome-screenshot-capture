(async function() {
  const render = require('./index.js');
  const result = await render({ url: 'http://google.com' });
  console.log('Result:', result);
})();