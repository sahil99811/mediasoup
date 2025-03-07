// const child_process = require("child_process");
// const { EventEmitter } = require("events");
// const { getCodecInfoFromRtpParameters } = require("../utils/helper");

// const GSTREAMER_DEBUG_LEVEL = process.env.GSTREAMER_DEBUG_LEVEL || 3;
// const GSTREAMER_COMMAND = "gst-launch-1.0";
// const GSTREAMER_OPTIONS = "-v -e";

// module.exports = class GStreamer {
//   constructor(rtpParameters) {
//     this._rtpParameters = rtpParameters;
//     this._process = undefined;
//     this._observer = new EventEmitter();
//     this._chunkDuration = 3; 
//     this._buffer = Buffer.alloc(0); 
//     this._createProcess();
//   }

//   async _createProcess() {
//     const exe = `${GSTREAMER_COMMAND} ${GSTREAMER_OPTIONS}`;
//     const env = { ...process.env, GST_DEBUG: GSTREAMER_DEBUG_LEVEL };
//     this._process = child_process.spawn(exe, this._commandArgs, {
//       detached: false,
//       shell: true,
//       env,
//     });

//     this._process.on("error", (error) =>
//       console.error(
//         "gstreamer::process::error [pid:%d, error:%o]",
//         this._process.pid,
//         error
//       )
//     );

//     this._process.once("close", () => {
//       console.log("gstreamer::process::close [pid:%d]", this._process.pid);
//       this._observer.emit("process-close");
//     });

//     this._process.stdout.on("data", (data) => this._handleStreamData(data));
//   }

//   _handleStreamData(data) {
//     // Accumulate the data into the buffer
//     this._buffer = Buffer.concat([this._buffer, data]);

//     // Check if the buffer has enough data for a 15-second chunk
//     const chunk = this._chunkData();

//     if (chunk) {
//       // Log that the chunk is ready for processing
//       console.log("3-second chunk complete and ready to send to Kafka",chunk);
//       // Send chunk to Kafka (commented out for now)
//       // producer
//       //   .send({
//       //     topic: "ml-topic", // Kafka topic
//       //     messages: [{ value: chunk }],
//       //   })
//       //   .then(() => {
//       //     console.log("Data chunk sent to Kafka.");
//       //   })
//       //   .catch((err) => {
//       //     console.error("Error sending chunk to Kafka:", err);
//       //   });
//     }
//   }

//   // Function to divide data into 15-second chunks
//   _chunkData() {
//     const chunkSize = this._chunkDuration * 1000; // 15 seconds in ms
//     if (this._buffer.length >= chunkSize) {
//       const chunk = this._buffer.slice(0, chunkSize); // Extract the 15-second chunk
//       this._buffer = this._buffer.slice(chunkSize); // Remove the chunk from the buffer
//       return chunk;
//     }
//     return null; // Not enough data yet for a full chunk
//   }

//   kill() {
//     console.log("kill() [pid:%d]", this._process.pid);
//     this._process.kill("SIGINT");
//   }

//   get _commandArgs() {
//     let commandArgs = [
//       `rtpbin name=rtpbin latency=50 buffer-mode=0 sdes="application/x-rtp-source-sdes, cname=(string)${this._rtpParameters.video.rtpParameters.rtcp.cname}"`,
//       "!",
//     ];

//     commandArgs = commandArgs.concat(this._videoArgs);
//     commandArgs = commandArgs.concat(this._sinkArgs);
//     commandArgs = commandArgs.concat(this._rtcpArgs);

//     return commandArgs;
//   }

//   get _videoArgs() {
//     const { video } = this._rtpParameters;
//     const videoCodecInfo = getCodecInfoFromRtpParameters(
//       "video",
//       video.rtpParameters
//     );

//     const VIDEO_CAPS = `application/x-rtp,media=(string)video,clock-rate=(int)${
//       videoCodecInfo.clockRate
//     },payload=(int)${
//       videoCodecInfo.payloadType
//     },encoding-name=(string)${videoCodecInfo.codecName.toUpperCase()},ssrc=(uint)${
//       video.rtpParameters.encodings[0].ssrc
//     }`;

//     return [
//       `udpsrc port=${video.remoteRtpPort} caps="${VIDEO_CAPS}"`,
//       "!",
//       "rtpbin.recv_rtp_sink_0 rtpbin.",
//       "!",
//       "queue",
//       "!",
//       "rtpvp8depay",
//       "!",
//       "mux.",
//     ];
//   }

//   get _audioArgs() {
//     const { audio } = this._rtpParameters;
//     const audioCodecInfo = getCodecInfoFromRtpParameters(
//       "audio",
//       audio.rtpParameters
//     );

//     const AUDIO_CAPS = `application/x-rtp,media=(string)audio,clock-rate=(int)${
//       audioCodecInfo.clockRate
//     },payload=(int)${
//       audioCodecInfo.payloadType
//     },encoding-name=(string)${audioCodecInfo.codecName.toUpperCase()},ssrc=(uint)${
//       audio.rtpParameters.encodings[0].ssrc
//     }`;

//     return [
//       `udpsrc port=${audio.remoteRtpPort} caps="${AUDIO_CAPS}"`,
//       "!",
//       "rtpbin.recv_rtp_sink_1 rtpbin.",
//       "!",
//       "queue",
//       "!",
//       "rtpopusdepay",
//       "!",
//       "opusdec",
//       "!",
//       "opusenc",
//       "!",
//       "mux.",
//     ];
//   }

//   get _rtcpArgs() {
//     const { video } = this._rtpParameters;

//     return [
//       `udpsrc address=127.0.0.1 port=${video.remoteRtcpPort}`,
//       "!",
//       "rtpbin.recv_rtcp_sink_0 rtpbin.send_rtcp_src_0",
//       "!",
//       `udpsink host=127.0.0.1 port=${video.localRtcpPort} bind-address=127.0.0.1 bind-port=${video.remoteRtcpPort} sync=false async=false`,
//     ];
//   }

//   get _sinkArgs() {
//     return [
//       "webmmux name=mux",
//       "!",
//       "appsink name=appsink emit-signals=true sync=false",
//     ];
//   }
// };




const child_process = require("child_process");
const { EventEmitter } = require("events");
const { PNG } = require("pngjs");
const fs = require("fs");
const path = require("path");
const { getCodecInfoFromRtpParameters } = require("../utils/helper");

const GSTREAMER_DEBUG_LEVEL = process.env.GSTREAMER_DEBUG_LEVEL || 3;
const GSTREAMER_COMMAND = "gst-launch-1.0";
const GSTREAMER_OPTIONS = "-v -e";

module.exports = class GStreamer {
  constructor(rtpParameters) {
    this._rtpParameters = rtpParameters;
    this._process = undefined;
    this._observer = new EventEmitter();
    this._frameCount = 0;
    this._createProcess();
  }

  async _createProcess() {
    const exe = `${GSTREAMER_COMMAND} ${GSTREAMER_OPTIONS}`;
    const env = { ...process.env, GST_DEBUG: GSTREAMER_DEBUG_LEVEL };
    this._process = child_process.spawn(exe, this._commandArgs, {
      detached: false,
      shell: true,
      env,
    });

    this._process.on("error", (error) =>
      console.error(
        "gstreamer::process::error [pid:%d, error:%o]",
        this._process.pid,
        error
      )
    );
    this._process.stderr.on("data", (data) =>
      console.error("GStreamer Error:", data.toString())
    );

    this._process.once("close", () => {
      console.log("gstreamer::process::close [pid:%d]", this._process.pid);
      this._observer.emit("process-close");
    });

    this._process.stdout.on("data", (data) => this._handleStreamData(data));
  }

  _handleStreamData(data) {
    const png = new PNG({ width: 1280, height: 720, inputHasAlpha: false }); // Adjust dimensions
    png.data = data;

    const chunks = [];
    png
      .pack()
      .on("data", (chunk) => chunks.push(chunk))
      .on("end", () => {
        const frameBuffer = Buffer.concat(chunks);
        const filePath = path.join(__dirname, `frame_${this._frameCount}.png`);

        fs.writeFile(filePath, frameBuffer, (err) => {
          if (err) {
            console.error("Error saving frame:", err);
          } else {
            console.log(`Frame saved as ${filePath}`);
          }
        });

        this._frameCount += 1;
      });
  }

  kill() {
    console.log("kill() [pid:%d]", this._process.pid);
    this._process.kill("SIGINT");
  }

  get _commandArgs() {
  let commandArgs = [
    `rtpbin name=rtpbin latency=50 buffer-mode=0 sdes="application/x-rtp-source-sdes, cname=(string)${this._rtpParameters.video.rtpParameters.rtcp.cname}"`,
    "!",
  ];

  commandArgs = commandArgs.concat(this._videoArgs);
  commandArgs = commandArgs.concat(this._sinkArgs);
  commandArgs = commandArgs.concat(this._rtcpArgs);

  return commandArgs;
}

get _videoArgs() {
  const { video } = this._rtpParameters;
  const videoCodecInfo = getCodecInfoFromRtpParameters(
    "video",
    video.rtpParameters
  );

//   const VIDEO_CAPS = `application/x-rtp,media=(string)video,clock-rate=(int)${
//     videoCodecInfo.clockRate
//   },payload=(int)${
//     videoCodecInfo.payloadType
//   },encoding-name=(string)${videoCodecInfo.codecName.toUpperCase()},ssrc=(uint)${
//     video.rtpParameters.encodings[0].ssrc
//   }`;
  const VIDEO_CAPS = `application/x-rtp,media=(string)video,clock-rate=(int)${
    videoCodecInfo.clockRate || 90000 // Default to 90000 Hz for video
  },payload=(int)${
    videoCodecInfo.payloadType
  },encoding-name=(string)${videoCodecInfo.codecName.toUpperCase()},ssrc=(uint)${
    video.rtpParameters.encodings[0].ssrc
  }`;

  return [
    `udpsrc port=${video.remoteRtpPort} caps="${VIDEO_CAPS}"`,
    "!",
    "rtpbin.recv_rtp_sink_0 rtpbin.",
    "!",
    "queue",
    "!",
    "rtpvp8depay",
    "!",
    "vp8dec",
    "!",
    "videoconvert",
    "!",
    "video/x-raw,format=RGB",
    "!",
    "queue",
    "!",
    "appsink name=myappsink emit-signals=true sync=false max-buffers=1 drop=true",
  ];
}

get _rtcpArgs() {
  const { video } = this._rtpParameters;

  return [
    `udpsrc address=127.0.0.1 port=${video.remoteRtcpPort}`,
    "!",
    "rtpbin.recv_rtcp_sink_0 rtpbin.send_rtcp_src_0",
    "!",
    `udpsink host=127.0.0.1 port=${video.localRtcpPort} bind-address=127.0.0.1 bind-port=${video.remoteRtcpPort} sync=false async=false`,
  ];
}

  get _sinkArgs() {
    return [
      "videoconvert",
      "!",
      "video/x-raw,format=RGB",
      "!",
      "queue"
    ];
  }
};
