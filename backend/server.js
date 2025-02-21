const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const mediasoup = require("mediasoup");
const { send } = require("process");
const app = express();

const server = http.createServer(app);
require("dotenv").config();
const port = process.env.PORT;
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
const rooms={}
const candidates={};
const owners={}
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

  socket.on("disconnect", () => {
    console.log("Peer disconnected");
  });

  socket.on("joinRoom", async ({ roomName }, callback) => {
    try {
      console.log(`Received request to create room: ${roomName}`);
      let router;
      if(!rooms[`room:${roomName}`]){
        router= await worker.createRouter({ mediaCodecs });
        rooms[`room:${roomName}`] = {
          roomName: roomName,
          router: router
        };
      }
      router = rooms[`room:${roomName}`].router;
      console.log(rooms);
      console.log(`Router created with ID: ${router.id}`);
      // Send RTP Capabilities back to the client
      callback({ rtpCapabilities: router.rtpCapabilities });
    } catch (error) {
      console.error("Error creating router:", error);
      callback({ error: error.message });
    }
  });

  console.log("hello ji connection");
  socket.on("getRtpCapabilities", ({ roomName }, callback) => {
    const room = rooms[`room:${roomName}`];
    if (!room) {
      return callback({ error: "Room not found" });
    }
    console.log("hello ji getRtpCapabilities");
    callback({ rtpCapabilities: room.router.rtpCapabilities });
  });

  socket.on("createWebrtcTransport", async ({ sender,userId,roomName,name }, callback) => {
    if (sender) {
      let producerTransport = await createWebRtcTransport(roomName,callback);
      candidates[`${roomName}:candidate:${userId}`]={
        name,
        userId,
        videoProducerTransport:producerTransport
      };
    } else {
      let consumerTransport = await createWebRtcTransport(roomName,callback);
      owners[`${roomName}:owner:${userId}`] = {
        name,
        userId,
        videoConsumerTransport: consumerTransport
      };;
    }
    console.log("webrtc transport created");
  });
  socket.on("transport-connect", async ({ dtlsParameters,roomName,userId }) => {
    console.log("transport-connect");
    const { videoProducerTransport } =candidates[`${roomName}:candidate:${userId}`];
    await videoProducerTransport?.connect({ dtlsParameters });
  });

  socket.on("transport-produce", async (data, callback) => {
    const { kind, rtpParameters,userId,roomName}=data;
    console.log("transport produce called");
    const { videoProducerTransport } =
      candidates[`${roomName}:candidate:${userId}`];
    let producer = await videoProducerTransport?.produce({
      kind,
      rtpParameters,
    });
    candidates[`${roomName}:candidate:${userId}`].videoProducer = producer;
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
  socket.on("transport-recv-connect", async ({ dtlsParameters,roomName ,userId}) => {
    console.log("transport-connect");
    const {videoConsumerTransport}=owners[`${roomName}:owner:${userId}`];
    await videoConsumerTransport?.connect({ dtlsParameters });
  });
  socket.on("getUser",async ({roomName},callback)=>{
    const roomCandidates = Object.keys(candidates)
      .filter((key) => key.startsWith(`${roomName}:candidate:`))
      .map((key) => ({
        userId: candidates[key].userId,
        name: candidates[key].name,
      }));
    console.log(roomCandidates);
    callback({roomCandidates});
  })
  socket.on("consume", async ({ rtpCapabilities,roomName,userId,candidateUserId }, callback) => {
    try {
      console.log("got consume media event");
      const { videoProducer } =
        candidates[`${roomName}:candidate:${candidateUserId}`];
      const { videoConsumerTransport } =owners[`${roomName}:owner:${userId}`];
      console.log(videoProducer, videoConsumerTransport);  
      const { router } = rooms[`room:${roomName}`]; 
      if (videoProducer) {
        console.log("got consume media event 1", videoProducer);
        if (
          !router.canConsume({ producerId: videoProducer?.id, rtpCapabilities })
        ) {
          console.error("Cannot consume");
          return;
        }
        console.log(
          "Producer is active:",
          videoProducer.id,
          videoProducer.closed === false
        );
        console.log(
          router.canConsume({ producerId: videoProducer.id, rtpCapabilities })
        );
        console.log("-------> consume");
        let consumer = await videoConsumerTransport?.consume({
          producerId: videoProducer?.id,
          rtpCapabilities,
          paused: videoProducer?.kind === "video",
        });
        owners[`${roomName}:owner:${userId}`].videoConsumer=consumer;
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
            producerId: videoProducer?.id,
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
  

  socket.on("resumePausedConsumer", async ({ roomName, userId }) => {
    const { videoConsumer } = owners[`${roomName}:owner:${userId}`];
    console.log("consume-resume");
    await videoConsumer?.resume();
  });
  
});

const  createWebRtcTransport = async (roomName,callback) => {
  try {
    console.log(process.env.ANNOUNCED_IP);
    const webRtcTransportOptions = {
      // listenIps: [
      //   {
      //     ip: "0.0.0.0",
      //     announcedIp: process.env.Announce_Ip,
      //   },
      // ],
      // enableUdp: true,
      // enableTcp: true,
      // preferUdp: true,
      // portRange: { min: 40000, max: 49999 },
      listenInfos: [
        {
          protocol: "udp",
          ip: process.env.MEDIASOUP_LISTEN_IP || "0.0.0.0",
          announcedAddress: process.env.ANNOUNCED_IP,
          portRange: {
            min: process.env.MEDIASOUP_MIN_PORT || 40000,
            max: process.env.MEDIASOUP_MAX_PORT || 49999,
          },
        },
        {
          protocol: "tcp",
          ip: process.env.MEDIASOUP_LISTEN_IP || "0.0.0.0",
          announcedAddress: process.env.ANNOUNCED_IP,
          portRange: {
            min: process.env.MEDIASOUP_MIN_PORT || 40000,
            max: process.env.MEDIASOUP_MAX_PORT || 49999,
          },
        },
      ],
      initialAvailableOutgoingBitrate: 1000000,
      minimumAvailableOutgoingBitrate: 600000,
      maxSctpMessageSize: 262144,
      // Additional options that are not part of WebRtcTransportOptions.
      maxIncomingBitrate: 1500000,
    };
    const router=rooms[`room:${roomName}`].router;
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
console.log(port)
server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
