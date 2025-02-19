const handleCreateTransport = async (data, callback, rooms) => {
  try {
    const { roomName, userId } = data;
    const router = rooms[roomName]?.router;

    if (!router) {
      return callback({ error: "Room not found" });
    }

    const transport = await router.createWebRtcTransport({
      listenIps: [{ ip: "0.0.0.0", announcedIp: "YOUR_PUBLIC_IP" }],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
    });

    rooms[roomName].producersTransport[userId] = transport;

    callback({
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    });
  } catch (error) {
    console.error("Error creating transport:", error);
    callback({ error: error.message });
  }
};

module.exports = { handleCreateTransport };
