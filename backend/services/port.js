const MIN_PORT = 20000;
const MAX_PORT = 30000;

const takenPortSet = new Set();

/**
 * Generates a random port within the defined range.
 * @returns {number} A random port number.
 */
const getRandomPort = () =>
  Math.floor(Math.random() * (MAX_PORT - MIN_PORT + 1) + MIN_PORT);

/**
 * Allocates an available port that is not already taken.
 * @returns {number} An available port number.
 */
const allocatePort = () => {
  let port;
  do {
    port = getRandomPort();
  } while (takenPortSet.has(port));

  takenPortSet.add(port);
  return port;
};

/**
 * Retrieves a pair of available RTP and RTCP ports.
 * @returns {{rtpPort: number, rtcpPort: number}} An object containing allocated ports.
 */
const getPort = async () => {
  const rtpPort = allocatePort();
  const rtcpPort = allocatePort();
   console.log(rtpPort,rtcpPort)
  return { rtpPort, rtcpPort };
};

/**
 * Releases the allocated RTP and RTCP ports.
 * @param {number} rtpPort - The RTP port to be released.
 * @param {number} rtcpPort - The RTCP port to be released.
 */
const releasePort = (rtpPort, rtcpPort) => {
  takenPortSet.delete(rtpPort);
  takenPortSet.delete(rtcpPort);
};

module.exports = { getPort, releasePort };
