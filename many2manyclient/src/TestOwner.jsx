"use client";

import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { Device } from "mediasoup-client";

export default function TestOwner({
  rtpCapabilities,
  socket,
  roomName,
  userId,
  roomCandidates,
}) {
  const remoteVideoRef = useRef(null);
  const [device, setDevice] = useState(null);
  const [consumerTransport, setConsumerTransport] = useState(null);
  const [selectedId, setSelectedId] = useState(""); // ✅ Fixed

  const createDevice = async () => {
    try {
      const newDevice = new Device();
      await newDevice.load({ routerRtpCapabilities: rtpCapabilities });
      setDevice(newDevice);
      console.log("✅ Device created");
    } catch (error) {
      console.error("❌ Error creating device:", error);
    }
  };

  const createRecvTransport = async () => {
    socket.emit(
      "createWebrtcTransport",
      { sender: false, roomName, userId },
      ({ params }) => {
        if (params.error) {
          console.log("❌ Error:", params.error);
          return;
        }

        const transport = device.createRecvTransport(params);
        setConsumerTransport(transport);

        transport.on(
          "connect",
          async ({ dtlsParameters }, callback, errback) => {
            try {
              await socket.emit("transport-recv-connect", {
                dtlsParameters,
                roomName,
                userId,
              });
              console.log("✅ Consumer transport connected");
              callback();
            } catch (error) {
              errback(error);
            }
          }
        );
      }
    );
  };

  const connectRecvTransport = async () => {
    console.log("🔹 Emitting socket connect receive transport");
    if (!selectedId) {
      console.warn("⚠️ Please select a user first.");
      return;
    }

    await socket.emit(
      "consume",
      {
        rtpCapabilities: device.rtpCapabilities,
        roomName,
        userId,
        candidateUserId: selectedId,
      },
      async ({ params }) => {
        if (params.error) {
          console.log("❌ Error:", params.error);
          return;
        }

        const consumer = await consumerTransport.consume({
          id: params.id,
          producerId: params.producerId,
          kind: params.kind,
          rtpParameters: params.rtpParameters,
        });

        if (consumer && consumer.track) {
          const stream = new MediaStream();
          stream.addTrack(consumer.track);
          remoteVideoRef.current.srcObject = stream;
          remoteVideoRef.current.muted = true;
          remoteVideoRef.current.play();
        }

        socket.emit("resumePausedConsumer", { userId, roomName });
        console.log(" Consumer transport resumed");
      }
    );
  };

  return (
    <main>
      <video ref={remoteVideoRef} id="remotevideo" autoPlay playsInline />
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <select
          style={{
            color: "white",
            backgroundColor: "black",
            padding: "8px",
            borderRadius: "5px",
          }}
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          <option value="">Select a candidate</option>
          {roomCandidates?.map((candidate) => (
            <option key={candidate.userId} value={candidate.userId}>
              {`name: ${candidate.name} userid: ${candidate.userId}`}
            </option>
          ))}
        </select>

        <button onClick={createDevice}>Create Device</button>
        <button onClick={createRecvTransport}>Create Recv Transport</button>
        <button onClick={connectRecvTransport}>
          Connect Recv Transport & Consume
        </button>
      </div>
    </main>
  );
}
