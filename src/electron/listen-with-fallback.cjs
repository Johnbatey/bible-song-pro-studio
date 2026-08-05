/* =========================================================================
   listenWithFallback — bind the first free port from a base upward
   -------------------------------------------------------------------------
   Its own module so it can be exercised without booting Electron. The bug it
   exists to prevent is not hypothetical: `server.listen(8942)` with no 'error'
   listener turns a port conflict — routine on a machine also running streaming
   or AV software — into an uncaught exception in the main process.
   ========================================================================= */

/**
 * @param {import('http').Server} server
 * @param {object} opts
 * @param {number} opts.basePort      first port to try
 * @param {number} opts.attempts      how many consecutive ports to try
 * @param {string} [opts.host]        defaults to all interfaces
 * @param {(port: number) => void} opts.onListening  called once, with the bound port
 * @param {(message: string) => void} opts.onError   called once, if none bind
 */
function listenWithFallback(server, { basePort, attempts, host = '0.0.0.0', onListening, onError }) {
  let attempt = 0;

  const tryListen = () => server.listen(basePort + attempt, host);

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && attempt < attempts - 1) {
      attempt += 1;
      // listen() is asynchronous, so this re-enters through the event loop
      // once per port rather than spinning.
      tryListen();
      return;
    }
    onError(err.code === 'EADDRINUSE'
      ? `Ports ${basePort}-${basePort + attempts - 1} are all in use`
      : `Local server failed to start (${err.code || err.message})`);
  });

  server.on('listening', () => onListening(server.address().port));

  tryListen();
}

module.exports = { listenWithFallback };
