const { kafka } = require("../config/kafkaConfig");


let producer; // Global producer instance

// Function to initialize the producer
const initializeProducer = async () => {
  if (!producer) {
    producer = kafka.producer();
    await producer.connect(); // Connect once when the producer is created
  }
};

// Function to send messages
const sendResultMessage1 = async (data, topic) => {
  await initializeProducer();
  let key = "default-key";
  try {
    await producer.send({
      topic: topic,
      messages: [{ key: key, value: JSON.stringify(data) }], // 🔥 Use `value`, not `data`
    });
    console.log(`Video chunk sent to Kafka topic: ${topic}`);
  } catch (error) {
    console.error(`Error sending message to ${topic} Kafka:`, error);
  }
};


// Close producer connection gracefully on application shutdown
const shutdownProducer = async () => {
  if (producer) {
    await producer.disconnect();
    console.log("Kafka producer disconnected.");
  }
};

process.on("SIGINT", shutdownProducer);
process.on("SIGTERM", shutdownProducer);

module.exports = { sendResultMessage1 };
