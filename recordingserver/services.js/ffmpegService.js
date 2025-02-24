const {spawn} = require("child_process");
const { EventEmitter } = require("events");

const { createSdpText } = require("../utils/sdp");
const { convertStringToStream } = require("../utils/helper");
const FFmpegStatic = require("ffmpeg-static");
const cmdProgram = FFmpegStatic;
const RECORD_FILE_LOCATION_PATH =
  process.env.RECORD_FILE_LOCATION_PATH || "./files";

module.exports = class FFmpeg {
  constructor(rtpParameters) {
    console.log(rtpParameters);
    this._rtpParameters = rtpParameters;
    this._process = undefined;
    this._observer = new EventEmitter();
    this._createProcess();
  }

  _createProcess() {
    const sdpString = createSdpText(this._rtpParameters);
    const sdpStream = convertStringToStream(sdpString);

    console.log("createProcess() [sdpString:%s]", sdpString);

    this._process = spawn(cmdProgram, this._commandArgs);

    if (this._process.stderr) {
      this._process.stderr.setEncoding("utf-8");

      this._process.stderr.on("data", (data) =>
        console.log("ffmpeg::process::data [data:%o]", data)
      );
    }

    if (this._process.stdout) {
      this._process.stdout.setEncoding("utf-8");

      this._process.stdout.on("data", (data) =>
        console.log("ffmpeg::process::data [data:%o]", data)
      );
    }

    this._process.on("message", (message) =>
      console.log("ffmpeg::process::message [message:%o]", message)
    );

    this._process.on("error", (error) =>
      console.error("ffmpeg::process::error [error:%o]", error)
    );

    this._process.once("close", () => {
      console.log("ffmpeg::process::close");
      this._observer.emit("process-close");
    });

    sdpStream.on("error", (error) =>
      console.error("sdpStream::error [error:%o]", error)
    );

    // Pipe sdp stream to the ffmpeg process
    sdpStream.resume();
    sdpStream.pipe(this._process.stdin);
  }

  kill() {
    console.log("kill() [pid:%d]", this._process.pid);
    this._process.kill("SIGINT");
  }

  get _commandArgs() {
    let commandArgs = [
      "-loglevel",
      "debug",
      "-protocol_whitelist",
      "pipe,udp,rtp",
      "-fflags",
      "+genpts",
      "-f",
      "sdp",
      "-i",
      "pipe:0",
    ];

    commandArgs = commandArgs.concat(this._videoArgs);

    console.log("commandArgs:%o", commandArgs);

    return commandArgs;
  }

  get _videoArgs() {
    return [
      "-map",
      "0:v:0",
      "-c:v",
      "libvpx", // Re-encode video using VP8 codec
      "-b:v",
      "1M", // Bitrate (adjust as needed)
      "-g",
      "60", // Force keyframe every 60 frames (~2 sec at 30 FPS)
      "-force_key_frames",
      "expr:gte(t,n*15)", // Force keyframe every 30 seconds
      "-f",
      "segment", // Enable segmentation
      "-segment_time",
      "15", // 30-second chunks
      "-reset_timestamps",
      "1", // Reset timestamps for each segment
      "-strftime",
      "1", // Unique filenames using timestamp
      `${RECORD_FILE_LOCATION_PATH}/chunk_%Y-%m-%d_%H-%M-%S.webm`, // Output naming pattern
    ];
  }
};
// const { spawn } = require("child_process");
// const { EventEmitter } = require("events");
// const { createSdpText } = require("../utils/sdp");
// const { convertStringToStream } = require("../utils/helper");
// const FFmpegStatic = require("ffmpeg-static");

// module.exports = class FFmpeg {
//   constructor(rtpParameters) {
//     console.log(rtpParameters);
//     this._rtpParameters = rtpParameters;
//     this._process = undefined;
//     this._observer = new EventEmitter();

//     this.currentChunk = Buffer.alloc(0);
//     this.chunkCounter = 0;
//     this.lastTimestamp = Date.now(); // Track time for chunks

//     this._createProcess();
//   }

//   _createProcess() {
//     const sdpString = createSdpText(this._rtpParameters);
//     const sdpStream = convertStringToStream(sdpString);

//     console.log("createProcess() [sdpString:%s]", sdpString);

//     this._process = spawn(FFmpegStatic, this._commandArgs);

//     if (this._process.stdout) {
//       this._process.stdout.on("data", async (chunk) => {
//         this.currentChunk = Buffer.concat([this.currentChunk, chunk]);
//         const now = Date.now();

//         // Check if 15 seconds have passed
//         if (now - this.lastTimestamp >= 15000) {
//           this.chunkCounter++;
//           console.log(`🎬 Chunk ${this.chunkCounter} (15 sec) completed!`);
//           this.lastTimestamp = now;
//           this.currentChunk = Buffer.alloc(0); // Reset for next chunk
//         }
//       });
//     }

//     this._process.once("close", () => {
//       console.log("❌ FFmpeg process closed unexpectedly!");
//       this._observer.emit("process-close");
//     });

//     this._process.on("error", (error) =>
//       console.error("ffmpeg::process::error [error:%o]", error)
//     );

//     sdpStream.on("error", (error) =>
//       console.error("sdpStream::error [error:%o]", error)
//     );

//     sdpStream.resume();
//     sdpStream.pipe(this._process.stdin);
//   }

//   kill() {
//     console.log("kill() [pid:%d]", this._process.pid);
//     this._process.kill("SIGINT");
//   }

//   get _commandArgs() {
//     return [
//       "-loglevel",
//       "debug",
//       "-protocol_whitelist",
//       "pipe,udp,rtp",
//       "-fflags",
//       "+genpts",
//       "-f",
//       "sdp",
//       "-i",
//       "pipe:0",
//       "-map",
//       "0:v:0",
//       "-c:v",
//       "libvpx", // VP8 encoding
//       "-b:v",
//       "1M",
//       "-g",
//       "60",
//       "-force_key_frames",
//       "expr:gte(t,n*15)", // Force keyframe every 15 seconds
//       "-f",
//       "webm",
//       "pipe:1",
//     ];
//   }
// };
