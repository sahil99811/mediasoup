"use client";

import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { Device } from "mediasoup-client";

export default function TestOwner({ rtpCapabilities, socket, roomName, userId }) {
  const remoteVideoRef = useRef(null);

  const [params, setParams] = useState({
    encoding: [
      { rid: "r0", maxBitrate: 100000, scalabilityMode: "S1T3" },
      { rid: "r1", maxBitrate: 300000, scalabilityMode: "S1T3" },
      { rid: "r2", maxBitrate: 900000, scalabilityMode: "S1T3" },
    ],
    codecOptions: { videoGoogleStartBitrate: 1000 },
  });

  const [device, setDevice] = useState(null);
  const [consumerTransport, setConsumerTransport] = useState(null);
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


  const createRecvTransport = async () => {
    socket.emit(
      "createWebrtcTransport",
      { sender: false, roomName, userId },
      ({ params }) => {
        if (params.error) {
          console.log(params.error);
          return;
        }

        let transport = device.createRecvTransport(params);
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
              console.log("----------> consumer transport has connected");
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
    console.log("emitting socket connect receive tranport");
    await socket.emit(
      "consume",
      { rtpCapabilities: device.rtpCapabilities, roomName, userId },
      async ({ params }) => {
        if (params.error) {
          console.log(params.error);
          return;
        }

        let consumer = await consumerTransport.consume({
          id: params.id,
          producerId: params.producerId,
          kind: params.kind,
          rtpParameters: params.rtpParameters,
        });

        const { track } = consumer;
        console.log("************** track", track);

        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = new MediaStream([track]);
          console.log(new MediaStream([track]));
        }

        socket.emit("resumePausedConsumer", () => {});
        console.log("----------> consumer transport has resumed");
      }
    );
  };
  
  console.log(params);
  return (
    <>
      <main>
        
        <video ref={remoteVideoRef} id="remotevideo" autoPlay playsInline />
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <button onClick={createDevice}>Create Device</button>
          <button onClick={createRecvTransport}>Create recv transport</button>
          <button onClick={connectRecvTransport}>
            Connect recv transport and consume
          </button>
        </div>
      </main>
    </>
  );
}
