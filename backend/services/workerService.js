const mediasoup = require("mediasoup");

const createWorker = async () => {
  const newWorker = await mediasoup.createWorker({
      rtcMinPort: 2000,
      rtcMaxPort: 2020,
    });
  
    console.log(`Worker process ID ${newWorker.pid}`);
    newWorker.on("died", (error) => {
      console.error("mediasoup worker has died");
      setTimeout(() => {
        process.exit();
      }, 2000);
    });
  
    return newWorker;
};

module.exports = { createWorker };
