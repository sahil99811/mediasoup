const express = require("express");

const { consumeMessages } = require("./kafka/consumer");

const app = express();
app.use(express.json());

const startServer = async () => {
  try {
    const server = app.listen(process.env.PORT || 3000, () => {
      console.log("Server started on PORT", process.env.PORT);
      consumeMessages().catch((err) => {
        console.error("Error setting up Kafka consumers:", err);
      });
    });
  } catch (error) {
    console.error("Failed to connect to database. Server not started.");
    process.exit(1);
  }
};

startServer();
