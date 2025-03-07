const { spawn } = require("child_process");
const { EventEmitter } = require("events");
const { createSdpText } = require("../utils/sdp");
const { convertStringToStream } = require("../utils/helper");
const FFmpegStatic = require("ffmpeg-static");
const sharp = require("sharp");
async function bufferToSharpImage(buffer) {
  const image = sharp(buffer);
  const metadata = await image.metadata();
  console.log("Image metadata:", metadata);
  return image;
}
class FFmpeg {
  constructor(rtpParameters) {
    this._rtpParameters = rtpParameters;
    this._process = null;
    this._observer = new EventEmitter();
    this._initProcess();
  }

  _initProcess() {
    const sdpString = createSdpText(this._rtpParameters);
    const sdpStream = convertStringToStream(sdpString);

    console.log("Starting FFmpeg with SDP:\n", sdpString);

    this._process = spawn(FFmpegStatic, this._commandArgs);

    this._process.stderr?.setEncoding("utf-8");
    this._process.stderr?.on("data", this._handleFFmpegLogs.bind(this));

    this._process.stdout?.on("data", async (frame) => {
      // Check if the buffer starts with PNG signature
      if (
        frame.length > 8 &&
        frame[0] === 0x89 &&
        frame[1] === 0x50 &&
        frame[2] === 0x4e &&
        frame[3] === 0x47
      ) {
        console.log("Valid PNG frame received");
        await bufferToSharpImage(frame)
          .then((img) =>
            img.toFile(`${Date.now()}.png`)
          )
          .catch((err) => console.error("Sharp processing error:", err));
        this._observer.emit("frame", frame);
      } else {
        console.warn("Skipping non-PNG frame...");
      }
    });


    this._process.on("error", (error) => {
      console.error("FFmpeg process error:", error);
      this._observer.emit("error", error);
    });

    this._process.once("close", (code, signal) => {
      console.log(`FFmpeg process exited with code ${code}, signal ${signal}`);
      this._observer.emit("process-close");
    });

    sdpStream.on("error", (error) => console.error("SDP stream error:", error));

    // Pipe SDP to FFmpeg
    sdpStream.pipe(this._process.stdin);
  }

  _handleFFmpegLogs(data) {
    const segmentMatch = data.match(
      /Opening '(.+?chunk_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.webm)' for writing/
    );
    if (segmentMatch) {
      console.log(`New chunk created: ${segmentMatch[1]}`);
      this._observer.emit("chunk-complete", segmentMatch[1]);
    }
  }

  kill() {
    if (this._process) {
      console.log("Terminating FFmpeg process...");
      this._process.kill("SIGINT");
      this._process = null;
    }
  }

  get _commandArgs() {
    return [
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
      ...this._videoArgs,
    ];
  }

  get _videoArgs() {
    return [
      "-map",
      "0:v:0",
      "-c:v",
      "png",
      "-vf",
      "fps=1",
      "-f",
      "image2pipe",
      "pipe:1",
    ];
  }
}

module.exports = FFmpeg;
