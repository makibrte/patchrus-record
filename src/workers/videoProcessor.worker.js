// Extension Worker for video processing
importScripts('fixWebmDuration.js', 'fixWebmDurationFallback.js');

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'video-processor') {
    port.onMessage.addListener(async (message) => {
      const { type, data } = message;

      switch (type) {
        case 'process-chunk':
          try {
            const { chunk, timestamp, index } = data;
            // Process individual chunk
            port.postMessage({
              type: 'chunk-processed',
              data: {
                index,
                chunk,
                timestam
              }
            });
          } catch (error) {
            port.postMessage({
              type: 'error',
              error: error.message
            });
          }
          break;

        case 'reconstruct-video':
          try {
            const { chunks, mimeType } = data;
            const blob = new Blob(chunks, { type: mimeType });
            port.postMessage({
              type: 'video-reconstructed',
              data: { blob }
            });
          } catch (error) {
            port.postMessage({
              type: 'error',
              error: error.message
            });
          }
          break;

        case 'fix-webm-duration':
          try {
            const { blob, duration, isWindows10 } = data;
            let fixedWebm;
            
            if (isWindows10) {
              fixedWebm = await fixWebmDurationFallback(blob, {
                type: "video/webm; codecs=vp8, opus"
              });
            } else {
              fixedWebm = await new Promise((resolve) => {
                fixWebmDuration(blob, duration, resolve, { logger: false });
              });
            }

            port.postMessage({
              type: 'webm-fixed',
              data: { fixedWebm }
            });
          } catch (error) {
            port.postMessage({
              type: 'error',
              error: error.message
            });
          }
          break;
      }
    });
  }
}); 