"use client";

import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { Device } from "mediasoup-client";

export default function Candidate({rtpCapabilities,socket,roomName,userId}) {
    console.log(rtpCapabilities, socket, roomName, userId);
  const videoRef = useRef(null);
  const [params, setParams] = useState({
    encoding: [
      { rid: "r0", maxBitrate: 100000, scalabilityMode: "S1T3" },
      { rid: "r1", maxBitrate: 300000, scalabilityMode: "S1T3" },
      { rid: "r2", maxBitrate: 900000, scalabilityMode: "S1T3" },
    ],
    codecOptions: { videoGoogleStartBitrate: 1000 },
  });

  const [device, setDevice] = useState(null);

  const [producerTransport, setProducerTransport] = useState(null);
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        const track = stream.getVideoTracks()[0];
        videoRef.current.srcObject = stream;
        setParams((current) => ({ ...current, track }));
      }
      console.log(videoRef.current);
    } catch (error) {
      console.error("Error accessing camera:", error);
    }
  };
  const createDevice = async () => {
    try {
      const newDevice = new Device();
      await newDevice.load({ routerRtpCapabilities: rtpCapabilities });
      setDevice(newDevice);
      console.log("device created");
    } catch (error) {
      console.log(error);
      if (error.name === "UnsupportedError") {
        console.error("Browser not supported");
      }
    }
  };

  const createSendTransport = async () => {
    socket.emit(
      "createWebrtcTransport",
      { sender: true, roomName, userId },
      ({ params }) => {
        if (params.error) {
          console.log(params.error);
          return;
        }

        let transport = device.createSendTransport(params);
        setProducerTransport(transport);

        transport.on(
          "connect",
          async ({ dtlsParameters }, callback, errback) => {
            try {
              console.log("----------> producer transport has connected");
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

        transport.on("produce", async (parameters, callback, errback) => {
          const { kind, rtpParameters } = parameters;

          console.log("----------> transport-produce");

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
        });
      }
    );
  };

  const connectSendTransport = async () => {
    let localProducer = await producerTransport.produce(params);

    localProducer.on("trackended", () => {
      console.log("trackended");
    });
    localProducer.on("transportclose", () => {
      console.log("transportclose");
    });
  }

  console.log(params);
  useEffect(()=>{
      startCamera()
  },[])
  return (
        <main>
       
          <video ref={videoRef} id="localvideo" autoPlay playsInline />
          <div
            style={{ display: "flex", flexDirection: "column", gap: "20px" }}
          >
            <button onClick={createDevice}>Create Device</button>
            <button onClick={createSendTransport}>
                Create send transport
            </button>
            <button onClick={connectSendTransport}>
                Connect send transport and produce
            </button>
          </div>
        </main>
  );
}
