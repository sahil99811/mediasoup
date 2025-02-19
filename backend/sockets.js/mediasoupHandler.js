const { createWorker } = require("../services/workerService");
const { handleConsume } = require("../controllers/consumerController");
const { handleProduce } = require("../controllers/producerController");
const { handleCreateTransport } = require("../controllers/transportController");
const {mediaCodecs}=require('../config/mediasCodecs')
let worker;
const rooms = {};

const initializeSocket = async (io) => {
  const peers = io.of("/mediasoup");

  worker = await createWorker();
  console.log("Mediasoup Worker created:", worker);

  peers.on("connection", (socket) => {
    console.log(`Peer connected: ${socket.id}`);
    socket.emit("connection-success", { socketId: socket.id });

    socket.on("disconnect", () => {
      console.log("Peer disconnected");
    });

    socket.on("joinRoom", async ({ roomName }, callback) => {
      try {
        console.log(`Received request to create/join room: ${roomName}`);
        let router;
        if (!rooms[roomName]) {
          router = await worker.createRouter({ mediaCodecs });
          rooms[roomName] = {
            router,
            producersTransport: {},
            producers: {},
            consumersTransport: {},
          };
        }
        router = rooms[roomName].router;
        console.log(`Router created with ID: ${router.id}`);
        callback({ rtpCapabilities: router.rtpCapabilities });
      } catch (error) {
        console.error("Error creating router:", error);
        callback({ error: error.message });
      }
    });

    socket.on("createWebrtcTransport", (data, callback) =>
      handleCreateTransport(data, callback, rooms)
    );

    socket.on(
      "transport-connect",
      async ({ dtlsParameters, roomName, userId }) => {
        await rooms[roomName].producersTransport[userId]?.connect({
          dtlsParameters,
        });
      }
    );

    socket.on("transport-produce", (data, callback) =>
      handleProduce(data, callback, rooms)
    );

    socket.on("consume", (data, callback) =>
      handleConsume(data, callback, rooms)
    );
  });
};

module.exports = { initializeSocket };
