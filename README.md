# PatchRus Record
Forked from https://github.com/alyssaxuu/screenity

Used for The Patchboys of South Milwaukee and Brookfield as a proposal recording tool. 
## Table of contents

- [Features](#features)
- [Self-hosting PatchRus Record](#self-hosting-screenity)
- [Creating a development version](#creating-a-development-version)
  - [Enabling Save to Google Drive](#enabling-save-to-google-drive)
- [Acknowledgements](#acknowledgements)

## Features

🎥 Make unlimited recordings of your tab, a specific area, desktop, any application, or camera<br>
🎙️ Record your microphone or internal audio, and use features like push to talk<br>
✏️ Annotate by drawing anywhere on the screen, adding text, arrows, shapes, and more<br>
✨ Use AI-powered camera backgrounds or blur to enhance your recordings<br>
🤖 AI transriptions and job proposal writing powered by AWS Transcribe and OpenAI API <br>
🔼 Uploads to AWS S3 for later cliet viewing <br>
🔎 Zoom in smoothly in your recordings to focus on specific areas<br>
🪄 Blur out any sensitive content of any page to keep it private<br>
✂️ Remove or add audio, cut, trim, or crop your recordings with a comprehensive editor<br>
👀 Highlight your clicks and cursor, and go in spotlight mode<br>
⏱️ Set up alarms to automatically stop your recording<br>
💾 Export as mp4, gif, and webm, or save the video directly to Google Drive to share a link<br>
⚙️ Set a countdown, hide parts of the UI, or move it anywhere<br>
🔒 Only you can see your videos, we don’t collect any of your data. You can even go offline!<br>
💙 No limits, make as many videos as you want, for as long as you want<br> …and much more - all for free & no sign in needed!

## Self-hosting PatchRus Record

You can run PatchRus Record locally without having to install it from the Chrome Store. All you need is a build directory. Due to this being for internal use the build directory is provided directly.



## Creating a development version

> ❗️ Note that the license has changed to [GPLv3](https://github.com/alyssaxuu/screenity/blob/master/LICENSE) for the current MV3 version (Screenity version 3.0.0 and higher). Make sure to read the license and the [Terms of Service](https://screenity.io/en/terms/) regarding intellectual property.

1. Check if your [Node.js](https://nodejs.org/) version is >= **14**.
2. Clone this repository.
3. Run `npm install` to install the dependencies.
4. Run `npm start`.
5. Load the extension by going to `chrome://extensions/` , and [enabling developer mode](https://developer.chrome.com/docs/extensions/mv2/faq/#:~:text=You%20can%20start%20by%20turning,a%20packaged%20extension%2C%20and%20more.).
6. Click on `Load unpacked extension`.
7. Select the `build` folder.

### Enabling Save to Google Drive

To enable the Google Drive Upload (authorization consent screen) you must change the client_id in the manifest.json file with your linked extension key.

You can create it accessing [Google Cloud Console](https://console.cloud.google.com/apis/credentials) and selecting Create Credential > OAuth Client ID > Chrome App. To create a persistent extension key, you can follow the steps detailed [here](https://developer.chrome.com/docs/extensions/reference/manifest/key).

## Libraries used

- [FFmpeg WASM](https://ffmpegwasm.netlify.app/) for editing and encoding videos
- [Tensorflow](https://github.com/tensorflow/tfjs) with the [Selfie Segmentation](https://blog.tensorflow.org/2022/01/body-segmentation.html) model
- [Fabric.js](https://github.com/fabricjs/fabric.js) for drawing and annotating
- [Radix Primitives](https://www.radix-ui.com/primitives) for the UI components
- [react-color](https://uiwjs.github.io/react-color/) for the color wheel
- [localForage](https://github.com/localForage/localForage) to help store videos offline with IndexedDB
- [Wavesurfer.js](https://wavesurfer.xyz/) to create audio waveforms in the popup and the editor
- [React Advanced Cropper](https://advanced-cropper.github.io/react-advanced-cropper/) for the cropping UI in the editor
- [fix-webm-duration](https://github.com/yusitnikov/fix-webm-duration) to add missing metadata to WEBM files

## Acknowledgements

- Thanks to screenity.io for providing their recording software tool, it is amazing!

If you need any help contact me@matejam.com
