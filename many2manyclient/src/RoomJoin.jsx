import { useState,useEffect ,useRef} from "react";
import { io } from "socket.io-client";
import { Device } from "mediasoup-client";
import Candidate from "./Candidate";
import TestOwner from "./TestOwner";
export default function RoomJoin() {
  const [roomName, setRoomName] = useState("");
  const [role, setRole] = useState("");
  const [socket, setSocket] = useState(null);
  const [userId, setUserId] = useState("");
  const [joined,setJoined]=useState(false);
  const [rtpCapabilities, setRtpCapabilities] = useState(null);
  const [roomCandidates, setRoomCandidates] = useState([]);
  const handleJoinRoom = () => {
    console.log(roomName, userId);
    if (!roomName.trim() || !userId.trim()) {
      alert("Please enter all fields!");
      return;
    }
    console.log(socket);
    socket.emit("joinRoom", { roomName, userId }, (response) => {
      if (response?.error) {
        console.error("Error creating room:", response.error);
        return;
      }
      console.log("printing rtp capibilities", response.rtpCapabilities);
      setRtpCapabilities(response.rtpCapabilities);
     
      // createDevice(response.rtpCapabilities);
    });
     if(role === "testOwner"){
          socket.emit("getUser", { roomName }, async ({ roomCandidates }) => {
            setRoomCandidates(roomCandidates || []);
             setJoined(true);
          });
     }else {
       setJoined(true);
     }
    console.log(`Joining room: ${roomName} as ${role}`);
  };

  useEffect(() => {
    const socket = io("http://13.127.83.66:5000/mediasoup");
    // const socket = io("http://localhost:5000/mediasoup");
    setSocket(socket);
    socket.on("connection-success", ({ socketId }) => {
      console.log("connection established succesffuly");
    });
    return () => {
      socket.disconnect();
    };
  }, []);
  return (
    <>
      {!joined ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "80vh",
            width: "80vw",
            backgroundColor: "#f3f4f6",
            gap: "16px",
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              padding: "24px",
              borderRadius: "16px",
              boxShadow: "0px 4px 10px rgba(0, 0, 0, 0.1)",
              width: "320px",
              textAlign: "center",
            }}
          >
            <h2
              style={{
                fontSize: "20px",
                fontWeight: "600",
                marginBottom: "16px",
                color: "black",
              }}
            >
              Join Mediasoup Room
            </h2>

            {/* Room Name Input */}
            <input
              type="text"
              placeholder="Enter Room Name"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              style={{
                width: "100%",
                padding: "8px",
                border: "1px solid #d1d5db",
                borderRadius: "8px",
                marginBottom: "16px",
                outline: "none",
                fontSize: "16px",
              }}
            />
            <input
              type="text"
              placeholder="Enter UserId"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              style={{
                width: "100%",
                padding: "8px",
                border: "1px solid #d1d5db",
                borderRadius: "8px",
                marginBottom: "16px",
                outline: "none",
                fontSize: "16px",
              }}
            />
            {/* Role Toggle */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                backgroundColor: "#e5e7eb",
                borderRadius: "8px",
                padding: "4px",
                marginBottom: "16px",
              }}
            >
              <button
                style={{
                  flex: "1",
                  padding: "8px",
                  borderRadius: "8px",
                  backgroundColor: role === "candidate" ? "#3b82f6" : "#d1d5db",
                  color: role === "candidate" ? "white" : "black",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "14px",
                }}
                onClick={() => setRole("candidate")}
              >
                Candidate
              </button>
              <button
                style={{
                  flex: "1",
                  padding: "8px",
                  borderRadius: "8px",
                  backgroundColor: role === "testOwner" ? "#3b82f6" : "#d1d5db",
                  color: role === "test_owner" ? "white" : "black",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "14px",
                }}
                onClick={() => setRole("testOwner")}
              >
                Test Owner
              </button>
            </div>

            {/* Join Room Button */}
            <button
              style={{
                width: "100%",
                backgroundColor: "#10b981",
                color: "white",
                padding: "10px",
                borderRadius: "8px",
                border: "none",
                cursor: "pointer",
                fontSize: "16px",
              }}
              onClick={handleJoinRoom}
              onMouseOver={(e) => (e.target.style.backgroundColor = "#059669")}
              onMouseOut={(e) => (e.target.style.backgroundColor = "#10b981")}
            >
              Join Room
            </button>
          </div>
        </div>
      ) : (
        <div>
          {role === "candidate" ? (
            <Candidate
              rtpCapabilities={rtpCapabilities}
              roomName={roomName}
              userId={userId}
              socket={socket}
            />
          ) : (
            <TestOwner
              rtpCapabilities={rtpCapabilities}
              roomName={roomName}
              userId={userId}
              socket={socket}
              roomCandidates={roomCandidates}
            />
          )}
        </div>
      )}
    </>
  );
}
