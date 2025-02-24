const { kafka } = require("../config/kafkaConfig");
const consumer = kafka.consumer({ groupId: "video-chunk-group" });

const consumeMessages = async () => {
  try {
    await consumer.connect();
    await consumer.subscribe({
      topics: [
        "camera-video-chunks"
      ],
    });

    await consumer.run({
      eachMessage: async ({ topic, message }) => {
        console.log(topic,message);
      },
    });
  } catch (error) {
    console.error("Error in Kafka consumer:", error.message);
  }
};

module.exports = { consumeMessages };
