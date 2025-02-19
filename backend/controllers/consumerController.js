const handleConsume = async (data, callback, rooms) => {
  try {
    const { roomName, userId, producerId, rtpCapabilities } = data;
    const router = rooms[roomName]?.router;

    if (!router) {
      return callback({ error: "Room not found" });
    }

    if (!router.canConsume({ producerId, rtpCapabilities })) {
      return callback({ error: "Cannot consume" });
    }

    const transport = rooms[roomName]?.consumersTransport[userId];
    const consumer = await transport.consume({
      producerId,
      rtpCapabilities,
      paused: true,
    });

    rooms[roomName].consumersTransport[userId] = consumer;

    callback({
      id: consumer.id,
      producerId,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
    });
  } catch (error) {
    console.error("Error consuming media:", error);
    callback({ error: error.message });
  }
};

module.exports = { handleConsume };
