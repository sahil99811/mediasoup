const createWebRtcTransport = async (router, callback) => {
  try {
    const webRtcTransportOptions = {
      listenIps: [{ ip: "127.0.0.1" }],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
    };

    const transport = await router.createWebRtcTransport(
      webRtcTransportOptions
    );
    console.log(`Transport created: ${transport.id}`);

    transport.on("dtlsstatechange", (dtlsState) => {
      if (dtlsState === "closed") transport.close();
    });

    transport.on("close", () => {
      console.log("Transport closed");
    });

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
    console.log("Error creating transport:", error);
    callback({ params: { error } });
  }
};

module.exports = { createWebRtcTransport };
