
import { useEffect, useRef, useState } from "react";
import { Device } from "mediasoup-client";

export default function TestOwner({
  rtpCapabilities,
  socket,
  roomName,
  userId,
  roomCandidates,
  name
}) {
  const remoteVideoRef = useRef(null);
  const [device, setDevice] = useState(null);
  const [consumerTransport, setConsumerTransport] = useState(null);
  const [selectedId, setSelectedId] = useState("");
  const [watching, setWatching] = useState(false);

  const startWatching = async () => {
    if (watching || !selectedId) {
      console.warn("⚠️ Select a candidate first.");
      return;
    }

    setWatching(true);

    try {
      const newDevice = await createDevice();
      if (!newDevice) return;

      const transport = await createRecvTransport(newDevice);
      if (!transport) return;

      await connectRecvTransport(transport, newDevice);
    } catch (error) {
      console.error("❌ Error in startWatching:", error);
      setWatching(false);
    }
  };

  const createDevice = async () => {
    try {
      const newDevice = new Device();
      await newDevice.load({ routerRtpCapabilities: rtpCapabilities });
      setDevice(newDevice);
      console.log("✅ Device created");
      return newDevice;
    } catch (error) {
      console.error("❌ Error creating device:", error);
      return null;
    }
  };

  const createRecvTransport = async (newDevice) => {
    return new Promise((resolve, reject) => {
      socket.emit(
        "createWebrtcTransport",
        { sender: false, roomName, userId },
        ({ params }) => {
          if (params?.error) {
            console.log("❌ Error:", params.error);
            reject(params.error);
            return;
          }

          console.log("✅ Received transport params:", params);
          const transport = newDevice.createRecvTransport(params);
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

          resolve(transport);
        }
      );
    });
  };

  const connectRecvTransport = async (transport, newDevice) => {
    console.log("🔹 Connecting to candidate stream...");
    socket.emit(
      "consume",
      {
        rtpCapabilities: newDevice.rtpCapabilities, // ✅ Using the newDevice
        roomName,
        userId,
        candidateUserId: selectedId,
      },
      async ({ params }) => {
        if (params?.error) {
          console.log("❌ Error:", params.error);
          return;
        }

        console.log("✅ Received consumer params:", params);

        const consumer = await transport.consume({
          id: params.id,
          producerId: params.producerId,
          kind: params.kind,
          rtpParameters: params.rtpParameters,
        });

        if (consumer && consumer.track) {
          console.log("✅ Consumer track received:", consumer.track);
          const stream = new MediaStream();
          stream.addTrack(consumer.track);

          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = stream;
            remoteVideoRef.current.muted = true;
            remoteVideoRef.current
              .play()
              .catch((error) => console.error("❌ Video play error:", error));
          }
        } else {
          console.warn("⚠️ No track received from consumer.");
        }

        socket.emit("resumePausedConsumer", { userId, roomName });
        console.log("✅ Consumer transport resumed");
      }
    );
  };
  useEffect(() => {
    if (!selectedId || !watching) return;

    console.log(`🔄 Switching to candidate: ${selectedId}`);
    if (remoteVideoRef.current?.srcObject) {
      remoteVideoRef.current.srcObject
        .getTracks()
        .forEach((track) => track.stop());
      remoteVideoRef.current.srcObject = null;
    }
    setWatching(false);
    startWatching();
  }, [selectedId]);

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

        <button onClick={startWatching} disabled={watching}>
          {watching ? "Watching..." : "Start Watching"}
        </button>
      </div>
    </main>
  );
}
