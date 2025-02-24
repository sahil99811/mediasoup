const { Readable } = require("stream");

// Converts a string (SDP) to a stream so it can be piped into the FFmpeg process
module.exports.convertStringToStream = (stringToConvert) => {
  const stream = new Readable();
  stream._read = () => {};
  stream.push(stringToConvert);
  stream.push(null);

  return stream;
};

// Gets codec information from rtpParameters
module.exports.getCodecInfoFromRtpParameters = (kind, rtpParameters) => {
  return {
    payloadType: rtpParameters.codecs[0].payloadType,
    codecName: rtpParameters.codecs[0].mimeType.replace(`${kind}/`, ""),
    clockRate: rtpParameters.codecs[0].clockRate,
    channels: undefined,
  };
};

const publishProducerRtpStream = async (peer, producer, ffmpegRtpCapabilities) => {
  console.log('publishProducerRtpStream()');

  // Create the mediasoup RTP Transport used to send media to the GStreamer process
  const rtpTransportConfig = config.plainRtpTransport;

  // If the process is set to GStreamer set rtcpMux to false
  if (PROCESS_NAME === 'GStreamer') {
    rtpTransportConfig.rtcpMux = false;
  }

  const rtpTransport = await createTransport('plain', router, rtpTransportConfig);

  // Set the receiver RTP ports
  const remoteRtpPort = await getPort();
  peer.remotePorts.push(remoteRtpPort);

  let remoteRtcpPort;
  // If rtpTransport rtcpMux is false also set the receiver RTCP ports
  if (!rtpTransportConfig.rtcpMux) {
    remoteRtcpPort = await getPort();
    peer.remotePorts.push(remoteRtcpPort);
  }


  // Connect the mediasoup RTP transport to the ports used by GStreamer
  await rtpTransport.connect({
    ip: '127.0.0.1',
    port: remoteRtpPort,
    rtcpPort: remoteRtcpPort
  });

  peer.addTransport(rtpTransport);

  const codecs = [];
  // Codec passed to the RTP Consumer must match the codec in the Mediasoup router rtpCapabilities
  const routerCodec = router.rtpCapabilities.codecs.find(
    codec => codec.kind === producer.kind
  );
  codecs.push(routerCodec);

  const rtpCapabilities = {
    codecs,
    rtcpFeedback: []
  };

  // Start the consumer paused
  // Once the gstreamer process is ready to consume resume and send a keyframe
  const rtpConsumer = await rtpTransport.consume({
    producerId: producer.id,
    rtpCapabilities,
    paused: true
  });

  peer.consumers.push(rtpConsumer);

  return {
    remoteRtpPort,
    remoteRtcpPort,
    localRtcpPort: rtpTransport.rtcpTuple ? rtpTransport.rtcpTuple.localPort : undefined,
    rtpCapabilities,
    rtpParameters: rtpConsumer.rtpParameters
  };
};