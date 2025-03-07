import { useEffect, useRef, useState } from "react";
import { Device } from "mediasoup-client";

export default function Candidate({
  rtpCapabilities,
  socket,
  roomName,
  userId,
  name
}) {
  const videoRef = useRef(null);
  const [device, setDevice] = useState(null);
  const [producerTransport, setProducerTransport] = useState(null);
  const [streaming, setStreaming] = useState(false);

  const params = {
    encodings: [
      {
        rid: "r0",
        maxBitrate: 100000,
        scalabilityMode: "S1T3",
        scaleResolutionDownBy: 4,
      },
      {
        rid: "r1",
        maxBitrate: 300000,
        scalabilityMode: "S1T3",
        scaleResolutionDownBy: 2,
      },
      {
        rid: "r2",
        maxBitrate: 900000,
        scalabilityMode: "S1T3",
        scaleResolutionDownBy: 1,
      },
    ],
    codecOptions: { videoGoogleStartBitrate: 1000 },
  };


  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      return stream.getVideoTracks()[0];
    } catch (error) {
      console.error("Error accessing camera:", error);
    }
  };

  const createDevice = async () => {
    try {
      const newDevice = new Device();
      await newDevice.load({ routerRtpCapabilities: rtpCapabilities });
      setDevice(newDevice);
      return newDevice;
    } catch (error) {
      console.error(error);
      return null;
    }
  };

  const createSendTransport = async (newDevice) => {
    return new Promise((resolve, reject) => {
      socket.emit(
        "createWebrtcTransport",
        { sender: true, roomName, userId,name },
        ({ params }) => {
          if (params?.error) {
            console.log(params.error);
            reject(params.error);
            return;
          }

          const transport = newDevice.createSendTransport(params);
          setProducerTransport(transport);

          transport.on(
            "connect",
            async ({ dtlsParameters }, callback, errback) => {
              try {
                socket.emit("transport-connect", {
                  dtlsParameters,
                  userId,
                  roomName,
                });
                callback();
              } catch (error) {
                errback(error);
              }
            }
          );

          transport.on(
            "produce",
            async ({ kind, rtpParameters }, callback, errback) => {
              try {
                socket.emit(
                  "transport-produce",
                  { kind, rtpParameters, userId, roomName },
                  ({ id }) => {
                    callback({ id });
                  }
                );
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

  const connectSendTransport = async (transport, track) => {
    try {
      let producer = await transport.produce({ track, ...params });

      producer.on("trackended", () => console.log("Track ended"));
      producer.on("transportclose", () => console.log("Transport closed"));

      return producer;
    } catch (error) {
      console.error("Error producing stream:", error);
    }
  };

  const startRecording = () => {
    socket.emit("start-recording", { roomName, userId }, () => {
      console.log("Recording started");
    });
  };

  const startStreaming = async () => {
    if (streaming) return;

    const track = await startCamera();
    if (!track) return;

    const newDevice = await createDevice();
    if (!newDevice) return;

    const transport = await createSendTransport(newDevice);
    if (!transport) return;

    await connectSendTransport(transport, track);
    setStreaming(true);
  };

  return (
    <main>
      <video ref={videoRef} id="localvideo" autoPlay playsInline />
      <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
        <button onClick={startStreaming} disabled={streaming}>
          {streaming ? "Streaming..." : "Start Streaming"}
        </button>
        <button onClick={startRecording}>Start Recording</button>
      </div>
    </main>
  );
}
