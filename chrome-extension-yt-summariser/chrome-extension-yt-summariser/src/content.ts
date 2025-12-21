import { getVideoTitle, getYouTubeTranscript } from './transcript-service';
import { injectSidebar } from './components/injectSidebar';

function isYouTubeVideoPage(): boolean {
  return window.location.hostname === "www.youtube.com" && window.location.search.includes("v=");
}

export function getVideoIdFromUrl(): string | null {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("v"); // "v" is the query parameter that holds the video ID in YouTube URLs
}

// This function waits for a specific element to be added to the DOM
async function waitForElement(elementId: string, timeoutMS = 5000): Promise<HTMLElement | null> {

  // First, check if the element is already present in the DOM
  const immediateCheck = document.getElementById(elementId);
  // If the element is found immediately, return it
  if (immediateCheck) return immediateCheck;

  // If the element is not found, create a promise that resolves when the element appears
  return new Promise((resolve, reject) => {

    // Select the node that will be observed for mutations (in this case, the entire body of the document)
    const targetNode = document.body;

    // Options for the observer (which mutations to observe)
    const config = { childList: true, subtree: true };

    const timeoutId = setTimeout(() => reject('Element not found within timeout'), timeoutMS);

    // Callback function to execute when mutations are observed
    const callback = (mutationList: MutationRecord[], observer: MutationObserver) => {

      // Stop observing once the element is found
      const element = document.getElementById(elementId);
      if (element) {
        observer.disconnect();
        clearTimeout(timeoutId);
        resolve(element);
      }
    }

    // Create a MutationObserver instance linked to the callback function
    const observer = new MutationObserver(callback);

    // Start observing the target node for configured mutations
    observer.observe(targetNode, config);
  });
}

let previousVideoId: string | null = null;
async function handleVideoChange() {
  try {

    if (!isYouTubeVideoPage()) {
      console.log('Not a YouTube video page. Skipping...');
      return;
    }

    // Only process if video ID is valid and different from the last processed video
    // YouTube can dynamically load a new video without performing a full page reload (single page application). 
    // So we manually check if the video ID in the URL has changed to ensure that the script processes only new video pages. 
    // This prevents re-injecting the sidebar or re-fetching data for the same video, optimizing performance and avoiding duplication.
    const videoId = getVideoIdFromUrl();
    if (!videoId || videoId === previousVideoId) return;
    previousVideoId = videoId;

    // Using Promise.all() to fetch both transcript and video title concurrently
    const [transcript, videoTitle] = await Promise.all([
      getYouTubeTranscript(videoId),
      getVideoTitle(videoId),
    ]);

    if (transcript && videoTitle) {
      const element = await waitForElement('related');
      if (element) {
        console.log('Injecting sidebar...');
        injectSidebar(videoTitle, transcript, videoId, element);
      }
    }
  } catch (error) {
    console.error('Error in YouTube summarizer:', error);
  }
}

// Sets up a MutationObserver to monitor changes to the DOM.
// This is necessary for detecting navigation events in YouTube's single-page application (SPA) structure.
function observeForVideoChanges() {
  const targetNode = document.body;
  // Configuration to observe changes in the DOM's child nodes and the entire subtree
  const config = { childList: true, subtree: true };
  // Create a MutationObserver that calls handleVideoChange whenever mutations are detected
  const observer = new MutationObserver(handleVideoChange);
  observer.observe(targetNode, config);
}

observeForVideoChanges();
