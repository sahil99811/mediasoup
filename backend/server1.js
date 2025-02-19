const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const mediasoup = require("mediasoup");
const { send } = require("process");
const app = express();
const port = 5000;
const server = http.createServer(app);

app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);
const io = new Server(server, {
  cors: {
    origin: "*",
    credentials: true,
  },
});
const peers = io.of("/mediasoup");
let worker;
let router;
let producerTransport;
let consumerTransport;
let producer;
let producerId;
let consumer;
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

(async () => {
  worker = await createWorker();
  console.log("Mediasoup Worker created:", worker);
})();
const mediaCodecs = [
  {
    /** Indicates this is an audio codec configuration */
    kind: "audio",
    /**
     * Specifies the MIME type for the Opus codec, known for good audio quality at various bit rates.
     * Format: <type>/<subtype>, e.g., audio/opus
     */
    mimeType: "audio/opus",
    /**
     * Specifies the number of audio samples processed per second (48,000 samples per second for high-quality audio).
     * Higher values generally allow better audio quality.
     */
    clockRate: 48000,
    /** Specifies the number of audio channels (2 for stereo audio). */
    channels: 2,
    /**
     * Optional: Specifies a preferred payload type number for the codec.
     * Helps ensure consistency in payload type numbering across different sessions or applications.
     */
    preferredPayloadType: 96, // Example value
    /**
     * Optional: Specifies a list of RTCP feedback mechanisms supported by the codec.
     * Helps optimize codec behavior in response to network conditions.
     */
    rtcpFeedback: [
      // Example values
      { type: "nack" },
      { type: "nack", parameter: "pli" },
    ],
  },
  {
    /** Indicates this is a video codec configuration */
    kind: "video",
    /** Specifies the MIME type for the VP8 codec, commonly used for video compression. */
    mimeType: "video/VP8",
    /** Specifies the clock rate, or the number of timing ticks per second (commonly 90,000 for video). */
    clockRate: 90000,
    /**
     * Optional: Specifies codec-specific parameters.
     * In this case, sets the starting bitrate for the codec.
     */
    parameters: {
      "x-google-start-bitrate": 1000,
    },
    preferredPayloadType: 97, // Example value
    rtcpFeedback: [
      // Example values
      { type: "nack" },
      { type: "ccm", parameter: "fir" },
      { type: "goog-remb" },
    ],
  },
];
peers.on("connection", async (socket) => {
  console.log(`Peer connected: ${socket.id}`);
  socket.emit("connection-success", { socketId: socket.id });
  if(!router){
    router = await worker.createRouter({ mediaCodecs });
    console.log(`router created:${router.id}`); 
  }
  socket.on("disconnect", () => {
    console.log("Peer disconnected");
  });
  socket.on("joinRoom", async ({ roomName }, callback) => {
    try {
      console.log(`Received request to create room: ${roomName}`);

      if (!router) {
        router = await worker.createRouter({ mediaCodecs });
        console.log(`Router created with ID: ${router.id}`);
      }

      // Send RTP Capabilities back to the client
      callback({ rtpCapabilities: router.rtpCapabilities });
    } catch (error) {
      console.error("Error creating router:", error);
      callback({ error: error.message });
    }
  });

  console.log("hello ji connection");
  socket.on("getRtpCapabilities", (callback) => {
    console.log("hello ji getRtpCapabilities");
    const rtpCapabilities = router.rtpCapabilities;
    callback({ rtpCapabilities });
  });
  socket.on("createWebrtcTransport", async ({ sender }, callback) => {
    if (sender) {
      producerTransport = await createWebRtcTransport(callback);
    } else {
      consumerTransport = await createWebRtcTransport(callback);
    }
    console.log("webrtc transport created",sender,producerTransport,consumerTransport);
  });
  socket.on("transport-connect", async ({ dtlsParameters,transport }) => {
    console.log("transport-connect");
    await producerTransport?.connect({ dtlsParameters });
  });
  socket.on("transport-produce", async (data, callback) => {
    console.log(data);
    const { kind, rtpParameters}=data;
    console.log("transport produce called");
    producer = await producerTransport?.produce({
      kind,
      rtpParameters
    });
    console.log("printing video:",kind,producer.id,producer);
    producerId=producer.id;
    console.log(producerId);
    producer.on("produce", (parameters, callback) => {
      console.log(`Producer is producing data:`, parameters);
      callback({ id: parameters.id });
    });
    producer?.on("transportclose", () => {
      console.log("Producer transport closed");
      producer?.close();
    });

    callback({ id: producer?.id });
  });
  socket.on("transport-recv-connect", async ({ dtlsParameters }) => {
    console.log(consumerTransport);
    await consumerTransport?.connect({ dtlsParameters });
  });
  socket.on("consume", async ({ rtpCapabilities }, callback) => {
    try {
      console.log("got consume media event",producer);
      if (producer) {
        console.log("got consume media event 1",producer);
        if (!router.canConsume({ producerId: producer?.id, rtpCapabilities })) {
          console.error("Cannot consume");
          return;
        }
          console.log(
            "Producer is active:",
            producer.id,
            producer.closed === false
          );
        console.log(
          router.canConsume({ producerId: producer.id, rtpCapabilities })
        );
        console.log("-------> consume");
        consumer = await consumerTransport?.consume({
          producerId: producer.id,
          rtpCapabilities,
          paused: producer?.kind === "video",
        });
        consumer?.on("transportclose", () => {
          console.log("Consumer transport closed");
          consumer?.close();
        });
        consumer?.on("producerclose", () => {
          console.log("Producer closed");
          consumer?.close();
        });
        callback({
          params: {
            producerId: producer?.id,
            id: consumer?.id,
            kind: consumer?.kind,
            rtpParameters: consumer?.rtpParameters,
          },
        });
      }
    } catch (error) {
      console.error("Error consuming:", error);
      callback({
        params: {
          error,
        },
      });
    }
  });
  socket.on("resumePausedConsumer", async () => {
    console.log("consume-resume");
    await consumer?.resume();
  });
});

const  createWebRtcTransport = async (callback) => {
  try {
    const webRtcTransportOptions = {
      listenIps: [
        {
          ip: "127.0.0.1",
        },
      ],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
    };
    const transport = await router.createWebRtcTransport(
      webRtcTransportOptions
    );

    console.log(`Transport created: ${transport.id}`);
    transport.on("dtlsstatechange", (dtlsState) => {
      if (dtlsState === "closed") {
        transport.close();
      }
    });
    transport.on("close", () => {
      console.log("Transport closed");
    });
    console.log("hello ji webrtc transport");
    callback({
      params: {
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
      },
    });
    return transport;
  } catch (error) {
    console.log(error);
    callback({
      params: {
        error,
      },
    });
  }
};
server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
