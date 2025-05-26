import React, { useContext, useEffect, useState, useRef } from "react";
import styles from "../../styles/player/_RightPanel.module.scss";
import JSZip from "jszip";
import { v4 as uuidv4 } from 'uuid';
import AWS from 'aws-sdk';
import { Buffer } from 'buffer';
import { ReactSVG } from "react-svg";

const URL =
  "chrome-extension://" + chrome.i18n.getMessage("@@extension_id") + "/assets/";

// Components
import CropUI from "../editor/CropUI";
import AudioUI from "../editor/AudioUI";

// Context
import { ContentStateContext } from "../../context/ContentState";

// Configure AWS
AWS.config.update({
  region: process.env.AWS_REGION,
  credentials: new AWS.Credentials({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  })
});

const s3 = new AWS.S3();


const RightPanel = () => {
  const [contentState, setContentState] = useContext(ContentStateContext); // Access the ContentState context
  const [webmFallback, setWebmFallback] = useState(false);
  const contentStateRef = useRef(contentState);
  const consoleErrorRef = useRef([]);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  // Override console.error to catch errors from ffmpeg.wasm
  useEffect(() => {
    console.error = (error) => {
      consoleErrorRef.current.push(error);
    };
    // Fetch customers from patchrus api
    const fetchCustomers = async () => {
      const response = await fetch("https://dev.patchrus.com/api/customers/get/base");
      const data = await response.json();
      console.log(data.data.data)
      setCustomers(data.data.data);
    };
    fetchCustomers();
  }, []);

  useEffect(() => {
    contentStateRef.current = contentState;
  }, [contentState]);

  const saveToDrive = () => {
    //if (contentState.noffmpeg) return;
    setContentState((prevContentState) => ({
      ...prevContentState,
      saveDrive: true,
    }));

    if (contentState.noffmpeg || !contentState.mp4ready || !contentState.blob) {
      chrome.runtime
        .sendMessage({
          type: "save-to-drive-fallback",
          title: contentState.title,
        })
        .then((response) => {
          if (response.status === "ew") {
            // Cancel saving to drive
            setContentState((prevContentState) => ({
              ...prevContentState,
              saveDrive: false,
            }));
          }
        });
    } else {
      // Blob to base64
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        const base64 = dataUrl.split(",")[1];

        chrome.runtime
          .sendMessage({
            type: "save-to-drive",
            base64: base64,
            title: contentState.title,
          })
          .then((response) => {
            if (response.status === "ew") {
              // Cancel saving to drive
              setContentState((prevContentState) => ({
                ...prevContentState,
                saveDrive: false,
              }));
            }
          });
      };
      if (
        !contentState.noffmpeg &&
        contentState.mp4ready &&
        contentState.blob
      ) {
        reader.readAsDataURL(contentState.blob);
      } else {
        reader.readAsDataURL(contentState.webm);
      }
    }
  };

  const signOutDrive = () => {
    chrome.runtime.sendMessage({ type: "sign-out-drive" });
    setContentState((prevContentState) => ({
      ...prevContentState,
      driveEnabled: false,
    }));
  };
  const handleUpload = async (base64, selectedCustomer) => {
    try {
      console.log("Uploading video to S3...");
      // Convert base64 to buffer
      const buffer = Buffer.from(base64, 'base64');
      
      if (!selectedCustomer || !selectedCustomer.id) {
        throw new Error("Invalid customer selected");
      }
      
      // Generate unique filename
      const filename = `${selectedCustomer.uuid}/${uuidv4()}.webm`;
      
      // Upload to S3
      const params = {
        Bucket: 'patchrus-proposals',
        Key: filename,
        Body: buffer,
        ContentType: 'video/webm'
      };


      const result = await s3.upload(params).promise();
      console.log("Upload result:", result);
      const awsUrl = result.Location;
      // Extract audio from video
      //const videoBlob = new Blob([buffer], { type: 'video/webm' });
      //console.log('Video blob size:', videoBlob.size);
      //const audioBlob = await getAudio(videoBlob);
      //console.log("Audio blob:", audioBlob);
      const audioBlob = new Blob([buffer], { 
        type: 'audio/webm;codecs=opus',
        quality: 0.5 // Adjust quality to reduce size
      });
      const file = new File([audioBlob], 'recording.webm', { type: 'video/webm' });
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('model', 'whisper-1');
      /*
      if (audioBlob) {
        const transcription = await transcribeAudio(audioBlob);
        try{
          const response = await fetch("https://dev.patchrus.com/api/rewritetranscript", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Origin": window.location.origin || "chrome-extension://" + chrome.runtime.id,
              "Access-Control-Request-Method": "POST",
              "Access-Control-Request-Headers": "Content-Type"
            },
            mode: 'cors',
            credentials: 'include',
            body: JSON.stringify({
              transcript: transcription.text,
              id: selectedCustomer.id,
              awsUrl: awsUrl
            }),
          });
          const data = await response.json();
          console.log(data);
        }catch(error){
          console.log("Error rewriting transcript:", error);
        }
      }*/
     /*
      try{
        const response = await fetch("https://dev.patchrus.com/api/email/draft/create",{
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Origin": window.location.origin || "chrome-extension://" + chrome.runtime.id,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Content-Type"
          },
          body: JSON.stringify({
            id: selectedCustomer.id
          })
        })
      }catch(error){
        console.log("Error creating email draft:", error);
      }
        */
      // Show success message
      alert("Upload successful!");
    } catch (error) {
      console.log('Error uploading video:', error);
      // Show error message
      alert("Upload failed!");
    }
  };

  const handleEdit = () => {
    if (
      contentState.duration > contentState.editLimit &&
      !contentState.override
    )
      return;
    if (!contentState.mp4ready) return;
    setContentState((prevContentState) => ({
      ...prevContentState,
      mode: "edit",
      dragInteracted: false,
    }));

    if (!contentState.hasBeenEdited) {
      setContentState((prevContentState) => ({
        ...prevContentState,
        hasBeenEdited: true,
      }));
    }
  };

  const handleCrop = () => {
    if (
      contentState.duration > contentState.editLimit &&
      !contentState.override
    )
      return;
    if (!contentState.mp4ready) return;
    setContentState((prevContentState) => ({
      ...prevContentState,
      mode: "crop",
    }));

    if (!contentState.hasBeenEdited) {
      setContentState((prevContentState) => ({
        ...prevContentState,
        hasBeenEdited: true,
      }));
    }
  };

  const handleAddAudio = async () => {
    if (
      contentState.duration > contentState.editLimit &&
      !contentState.override
    )
      return;
    if (!contentState.mp4ready) return;
    setContentState((prevContentState) => ({
      ...prevContentState,
      mode: "audio",
    }));

    if (!contentState.hasBeenEdited) {
      setContentState((prevContentState) => ({
        ...prevContentState,
        hasBeenEdited: true,
      }));
    }
  };

  const handleRawRecording = () => {
    if (typeof contentStateRef.current.openModal === "function") {
      contentStateRef.current.openModal(
        chrome.i18n.getMessage("rawRecordingModalTitle"),
        chrome.i18n.getMessage("rawRecordingModalDescription"),
        chrome.i18n.getMessage("rawRecordingModalButton"),
        chrome.i18n.getMessage("sandboxEditorCancelButton"),
        () => {
          const blob = contentStateRef.current.rawBlob;
          const url = window.URL.createObjectURL(blob);
          chrome.downloads.download(
            {
              url: url,
              filename: "raw-recording.webm",
            },
            () => {
              window.URL.revokeObjectURL(url);
            }
          );
        },
        () => {}
      );
    }
  };

  const handleTroubleshooting = () => {
    if (typeof contentStateRef.current.openModal === "function") {
      contentStateRef.current.openModal(
        chrome.i18n.getMessage("troubleshootModalTitle"),
        chrome.i18n.getMessage("troubleshootModalDescription"),
        chrome.i18n.getMessage("troubleshootModalButton"),
        chrome.i18n.getMessage("sandboxEditorCancelButton"),
        () => {
          // Need to create a file with the original data, any console logs, and system info
          const userAgent = navigator.userAgent;
          let platformInfo = {};
          chrome.runtime.getPlatformInfo(function (info) {
            platformInfo = info;
            const manifestInfo = chrome.runtime.getManifest().version;
            const blob = contentStateRef.current.rawBlob;

            // Now we need to create a file with all of this data
            const data = {
              userAgent: userAgent,
              platformInfo: platformInfo,
              manifestInfo: manifestInfo,
              contentState: contentStateRef.current,
            };
            // Create a zip file with the original recording and the data
            const zip = new JSZip();
            zip.file("recording.webm", blob);
            zip.file("troubleshooting.json", JSON.stringify(data));
            zip.generateAsync({ type: "blob" }).then(function (blob) {
              const url = window.URL.createObjectURL(blob);
              chrome.downloads.download(
                {
                  url: url,
                  filename: "troubleshooting.zip",
                },
                () => {
                  window.URL.revokeObjectURL(url);
                }
              );
            });
          });
        },
        () => {}
      );
    }
  };

  // Add message listener for upload responses
  useEffect(() => {
    const handleMessage = (message) => {
      if (message.type === 'upload-success') {
        contentState.openToast(chrome.i18n.getMessage("uploadSuccessMessage"), () => {});
      } else if (message.type === 'upload-error') {
        contentState.openToast(chrome.i18n.getMessage("uploadErrorMessage"), () => {});
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, [contentState]);

  useEffect(() => {
    console.log("selectedCustomer state changed:", selectedCustomer);
  }, [selectedCustomer]);

  useEffect(() => {
    console.log("contentState.selectedCustomer changed:", contentState.selectedCustomer);
  }, [contentState.selectedCustomer]);

  // Initialize local state from context if it exists
  useEffect(() => {
    if (contentState.selectedCustomer && !selectedCustomer) {
      setSelectedCustomer(contentState.selectedCustomer);
    }
  }, []);

  return (
    <div className={styles.panel}>
      <div className="customer-select">
        <label className="customer-select-label">
          Select Customer
          {chrome.i18n.getMessage("selectCustomerLabel")}
        </label>
        <select 
          className="customer-select-input"
          value={contentState.selectedCustomer ? contentState.selectedCustomer.id : ""}
          onChange={(e) => {
            console.log("Selected customer:", e.target.value);
            const customerId = parseInt(e.target.value);
            const selectedCustomer = customers.find(customer => customer.id === customerId);
            setSelectedCustomer(selectedCustomer);
            setContentState((prevContentState) => ({
              ...prevContentState,
              selectedCustomer: selectedCustomer
            }));
          }}
        >
          <option value="">{chrome.i18n.getMessage("selectCustomerPlaceholder")}</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.job_name}
            </option>
          ))}
        </select>
      </div>
      {contentState.mode === "audio" && <AudioUI />}
      {contentState.mode === "crop" && <CropUI />}
      {contentState.mode === "player" && (
        <div>
          {!contentState.fallback && contentState.offline && (
            <div className={styles.alert}>
              <div className={styles.buttonLeft}>
                <ReactSVG src={URL + "editor/icons/no-internet.svg"} />
              </div>
              <div className={styles.buttonMiddle}>
                <div className={styles.buttonTitle}>
                  {chrome.i18n.getMessage("offlineLabelTitle")}
                </div>
                <div className={styles.buttonDescription}>
                  {chrome.i18n.getMessage("offlineLabelDescription")}
                </div>
              </div>
              <div className={styles.buttonRight}>
                {chrome.i18n.getMessage("offlineLabelTryAgain")}
              </div>
            </div>
          )}
          {contentState.fallback && (
            <div className={styles.alert}>
              <div className={styles.buttonLeft}>
                <ReactSVG src={URL + "editor/icons/alert.svg"} />
              </div>
              <div className={styles.buttonMiddle}>
                <div className={styles.buttonTitle}>
                  {chrome.i18n.getMessage("recoveryModeTitle")}
                </div>
                <div className={styles.buttonDescription}>
                  {chrome.i18n.getMessage("overLimitLabelDescription")}
                </div>
              </div>
            </div>
          )}
          {!contentState.fallback &&
            contentState.updateChrome &&
            !contentState.offline &&
            contentState.duration <= contentState.editLimit && (
              <div className={styles.alert}>
                <div className={styles.buttonLeft}>
                  <ReactSVG src={URL + "editor/icons/alert.svg"} />
                </div>
                <div className={styles.buttonMiddle}>
                  <div className={styles.buttonTitle}>
                    {chrome.i18n.getMessage("updateChromeLabelTitle")}
                  </div>
                  <div className={styles.buttonDescription}>
                    {chrome.i18n.getMessage("updateChromeLabelDescription")}
                  </div>
                </div>
                <div
                  className={styles.buttonRight}
                  onClick={() => {
                    chrome.runtime.sendMessage({ type: "chrome-update-info" });
                  }}
                >
                  {chrome.i18n.getMessage("learnMoreLabel")}
                </div>
              </div>
            )}
          {!contentState.fallback &&
            contentState.duration > contentState.editLimit &&
            !contentState.override &&
            !contentState.offline &&
            !contentState.updateChrome && (
              <div className={styles.alert}>
                <div className={styles.buttonLeft}>
                  <ReactSVG src={URL + "editor/icons/alert.svg"} />
                </div>
                <div className={styles.buttonMiddle}>
                  <div className={styles.buttonTitle}>
                    {chrome.i18n.getMessage("overLimitLabelTitle")}
                  </div>
                  <div className={styles.buttonDescription}>
                    {chrome.i18n.getMessage("overLimitLabelDescription")}
                  </div>
                </div>
                <div
                  className={styles.buttonRight}
                  onClick={() => {
                    //chrome.runtime.sendMessage({ type: "upgrade-info" });
                    if (typeof contentState.openModal === "function") {
                      contentState.openModal(
                        chrome.i18n.getMessage("overLimitModalTitle"),
                        chrome.i18n.getMessage("overLimitModalDescription"),
                        chrome.i18n.getMessage("overLimitModalButton"),
                        chrome.i18n.getMessage("sandboxEditorCancelButton"),
                        () => {
                          setContentState((prevContentState) => ({
                            ...prevContentState,
                            saved: true,
                          }));
                          chrome.runtime.sendMessage({
                            type: "force-processing",
                          });
                        },
                        () => {},
                        null,
                        chrome.i18n.getMessage("overLimitModalLearnMore"),
                        () => {
                          chrome.runtime.sendMessage({ type: "upgrade-info" });
                        }
                      );
                    }
                  }}
                >
                  {chrome.i18n.getMessage("learnMoreLabel")}
                </div>
              </div>
            )}
          {(!contentState.mp4ready || contentState.isFfmpegRunning) &&
            (contentState.duration <= contentState.editLimit ||
              contentState.override) &&
            !contentState.offline &&
            !contentState.updateChrome &&
            !contentState.noffmpeg && (
              <div className={styles.alert}>
                <div className={styles.buttonLeft}>
                  <ReactSVG src={URL + "editor/icons/alert.svg"} />
                </div>
                <div className={styles.buttonMiddle}>
                  <div className={styles.buttonTitle}>
                    {chrome.i18n.getMessage("videoProcessingLabelTitle")}
                  </div>
                  <div className={styles.buttonDescription}>
                    {chrome.i18n.getMessage("videoProcessingLabelDescription")}
                  </div>
                </div>
                <div
                  className={styles.buttonRight}
                  onClick={() => {
                    chrome.runtime.sendMessage({
                      type: "open-processing-info",
                    });
                  }}
                >
                  {chrome.i18n.getMessage("learnMoreLabel")}
                </div>
              </div>
            )}

          <div className={styles.section}>
            <div className={styles.sectionTitle}>
              {chrome.i18n.getMessage("sandboxEditTitle")}
            </div>
            <div className={styles.buttonWrap}>
              <div
                role="button"
                className={styles.button}
                onClick={handleEdit}
                disabled={
                  (contentState.duration > contentState.editLimit &&
                    !contentState.override) ||
                  !contentState.mp4ready ||
                  contentState.noffmpeg
                }
              >
                <div className={styles.buttonLeft}>
                  <ReactSVG src={URL + "editor/icons/trim.svg"} />
                </div>
                <div className={styles.buttonMiddle}>
                  <div className={styles.buttonTitle}>
                    {chrome.i18n.getMessage("editButtonTitle")}
                  </div>
                  <div className={styles.buttonDescription}>
                    {contentState.offline && !contentState.ffmpegLoaded
                      ? chrome.i18n.getMessage("noConnectionLabel")
                      : contentState.updateChrome ||
                        contentState.noffmpeg ||
                        (contentState.duration > contentState.editLimit &&
                          !contentState.override)
                      ? chrome.i18n.getMessage("notAvailableLabel")
                      : contentState.mp4ready
                      ? chrome.i18n.getMessage("editButtonDescription")
                      : chrome.i18n.getMessage("preparingLabel")}
                  </div>
                </div>
                <div className={styles.buttonRight}>
                  <ReactSVG src={URL + "editor/icons/right-arrow.svg"} />
                </div>
              </div>
            </div>
          </div>
          <div className={styles.section}>
            <div className={styles.sectionTitle}>
              {chrome.i18n.getMessage("sandboxSaveTitle")}
            </div>
            <div className={styles.buttonWrap}>
              <div
                role="button"
                className={styles.button}
                onClick={() => {
                  if (!contentState.mp4ready) return;
                  if (!contentState.selectedCustomer) {
                    contentState.openToast("Please select a customer first", () => {});
                    return;
                  }
                  // Convert blob to base64
                  const reader = new FileReader();
                  reader.onload = () => {
                    const dataUrl = reader.result;
                    const base64 = dataUrl.split(",")[1];
        
                    // Call handleUpload with the base64 data and selected customer
                    handleUpload(base64, contentState.selectedCustomer);
                  };
                  reader.readAsDataURL(contentState.blob);
                }}
                disabled={!contentState.mp4ready}
              >
                <div className={styles.buttonLeft}>
                  <ReactSVG src={URL + "editor/icons/upload.svg"} />
                </div>
                <div className={styles.buttonMiddle}>
                  <div className={styles.buttonTitle}>
                    Upload video
                  </div>
                  <div className={styles.buttonDescription}>
                    {contentState.offline
                      ? chrome.i18n.getMessage("noConnectionLabel")
                      : contentState.updateChrome
                      ? chrome.i18n.getMessage("notAvailableLabel")
                      : chrome.i18n.getMessage("uploadButtonDescription")}
                  </div>
                </div>
                <div className={styles.buttonRight}>
                  <ReactSVG src={URL + "editor/icons/right-arrow.svg"} />
                </div>
              </div>
            </div>
          </div>
          <div className={styles.section}>
            <div className={styles.sectionTitle}>
              {chrome.i18n.getMessage("sandboxExportTitle")}
            </div>
            <div className={styles.buttonWrap}>
              {contentState.fallback && (
                <div
                  role="button"
                  className={styles.button}
                  onClick={() => contentState.downloadWEBM()}
                  disabled={contentState.isFfmpegRunning}
                >
                  <div className={styles.buttonLeft}>
                    <ReactSVG src={URL + "editor/icons/download.svg"} />
                  </div>
                  <div className={styles.buttonMiddle}>
                    <div className={styles.buttonTitle}>
                      {contentState.downloadingWEBM
                        ? chrome.i18n.getMessage("downloadingLabel")
                        : chrome.i18n.getMessage("downloadWEBMButtonTitle")}
                    </div>
                    <div className={styles.buttonDescription}>
                      {chrome.i18n.getMessage("downloadWEBMButtonDescription")}
                    </div>
                  </div>
                  <div className={styles.buttonRight}>
                    <ReactSVG src={URL + "editor/icons/right-arrow.svg"} />
                  </div>
                </div>
              )}
              <div
                role="button"
                className={styles.button}
                onClick={() => {
                  if (!contentState.mp4ready) return;
                  contentState.download();
                }}
                disabled={
                  contentState.isFfmpegRunning ||
                  contentState.noffmpeg ||
                  !contentState.mp4ready ||
                  contentState.noffmpeg
                }
              >
                <div className={styles.buttonLeft}>
                  <ReactSVG src={URL + "editor/icons/download.svg"} />
                </div>
                <div className={styles.buttonMiddle}>
                  <div className={styles.buttonTitle}>
                    {contentState.downloading
                      ? chrome.i18n.getMessage("downloadingLabel")
                      : chrome.i18n.getMessage("downloadMP4ButtonTitle")}
                  </div>
                  <div className={styles.buttonDescription}>
                    {contentState.offline && !contentState.ffmpegLoaded
                      ? chrome.i18n.getMessage("noConnectionLabel")
                      : contentState.updateChrome ||
                        contentState.noffmpeg ||
                        (contentState.duration > contentState.editLimit &&
                          !contentState.override)
                      ? chrome.i18n.getMessage("notAvailableLabel")
                      : contentState.mp4ready && !contentState.isFfmpegRunning
                      ? chrome.i18n.getMessage("downloadMP4ButtonDescription")
                      : chrome.i18n.getMessage("preparingLabel")}
                  </div>
                </div>
                <div className={styles.buttonRight}>
                  <ReactSVG src={URL + "editor/icons/right-arrow.svg"} />
                </div>
              </div>
              {!contentState.fallback && (
                <div
                  role="button"
                  className={styles.button}
                  onClick={() => contentState.downloadWEBM()}
                  disabled={contentState.isFfmpegRunning}
                >
                  <div className={styles.buttonLeft}>
                    <ReactSVG src={URL + "editor/icons/download.svg"} />
                  </div>
                  <div className={styles.buttonMiddle}>
                    <div className={styles.buttonTitle}>
                      {contentState.downloadingWEBM
                        ? chrome.i18n.getMessage("downloadingLabel")
                        : chrome.i18n.getMessage("downloadWEBMButtonTitle")}
                    </div>
                    <div className={styles.buttonDescription}>
                      {!contentState.isFfmpegRunning
                        ? chrome.i18n.getMessage(
                            "downloadWEBMButtonDescription"
                          )
                        : chrome.i18n.getMessage("preparingLabel")}
                    </div>
                  </div>
                  <div className={styles.buttonRight}>
                    <ReactSVG src={URL + "editor/icons/right-arrow.svg"} />
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className={styles.section}>
            {/* Create an advanced section with a button to send logs and to download raw video file as a backup */}
            <div className={styles.sectionTitle}>
              {chrome.i18n.getMessage("sandboxAdvancedTitle")}
            </div>
            <div className={styles.buttonWrap}>
              <div
                role="button"
                className={styles.button}
                onClick={() => {
                  handleRawRecording();
                }}
              >
                <div className={styles.buttonLeft}>
                  <ReactSVG src={URL + "editor/icons/download.svg"} />
                </div>
                <div className={styles.buttonMiddle}>
                  <div className={styles.buttonTitle}>
                    {chrome.i18n.getMessage("rawRecordingButtonTitle")}
                  </div>
                  <div className={styles.buttonDescription}>
                    {chrome.i18n.getMessage("rawRecordingButtonDescription")}
                  </div>
                </div>
                <div className={styles.buttonRight}>
                  <ReactSVG src={URL + "editor/icons/right-arrow.svg"} />
                </div>
              </div>
              <div
                role="button"
                className={styles.button}
                onClick={() => {
                  handleTroubleshooting();
                }}
              >
                <div className={styles.buttonLeft}>
                  <ReactSVG src={URL + "editor/icons/flag.svg"} />
                </div>
                <div className={styles.buttonMiddle}>
                  <div className={styles.buttonTitle}>
                    {chrome.i18n.getMessage("troubleshootButtonTitle")}
                  </div>
                  <div className={styles.buttonDescription}>
                    {chrome.i18n.getMessage("troubleshootButtonDescription")}
                  </div>
                </div>
                <div className={styles.buttonRight}>
                  <ReactSVG src={URL + "editor/icons/right-arrow.svg"} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RightPanel;
