module.exports = {
  worker: {
    // logLevel: "debug", // "debug", "warn", "error", "none"
    // logTags: [
    //   // "bwe",
    //   "dtls",
    //   "ice",
    //   "info",
    //   "rtcp",
    //   "rtp",
    //   // "rtx",
    //   // "score",
    //   // "sctp",
    //   // "simulcast",
    //   "srtp",
    //   // "svc"
    // ],
    rtcMinPort: 2000,
    rtcMaxPort: 2020,
  },
  router: {
    mediaCodec: [
      {
        kind: "audio",
        mimeType: "audio/opus",
        clockRate: 48000,
        channels: 2,
      },
      {
        kind: "video",
        mimeType: "video/VP8",
        clockRate: 90000,
        parameters: {
          "x-google-start-bitrate": 1000,
        },
      },
      {
        kind: "video",
        mimeType: "video/VP9",
        clockRate: 90000,
        parameters: {
          "profile-id": 2,
          "x-google-start-bitrate": 1000,
        },
      },
      {
        kind: "video",
        mimeType: "video/H264",
        clockRate: 90000,
        parameters: {
          "packetization-mode": 1,
          "profile-level-id": "42e01f",
          "level-asymmetry-allowed": 1,
          "x-google-start-bitrate": 1000,
        },
      },
    ],
  },
  webRtcTransport: {
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
    maxIncomingBitrate: 1500000,
  },
  plainRtpTransport: {
    listenIp: { ip: "127.0.0.1", announcedIp: null },
  },
  recording: {
    ip: "127.0.0.1",
  },
};