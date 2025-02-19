const handleProduce = async (data, callback, rooms) => {
  try {
    const { roomName, userId, kind, rtpParameters } = data;
    const transport = rooms[roomName]?.producersTransport[userId];

    if (!transport) {
      return callback({ error: "Transport not found" });
    }

    const producer = await transport.produce({ kind, rtpParameters });
    rooms[roomName].producers[userId] = producer;

    callback({ id: producer.id });
  } catch (error) {
    console.error("Error producing media:", error);
    callback({ error: error.message });
  }
};

module.exports = { handleProduce };
