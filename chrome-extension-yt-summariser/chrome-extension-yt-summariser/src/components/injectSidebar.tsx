import { createRoot, Root } from 'react-dom/client';
import { Sidebar } from './Sidebar';

// This function injects the sidebar into the YouTube page
let summarizerRoot: Root;
export async function injectSidebar(title: string, transcript: string, videoId: string, parentElement: HTMLElement) {

  // Try to get the summarizer sidebar container by ID. This checks if the sidebar container already exists.
  let summarizer = document.getElementById('yt-summarizer-sidebar-container');

  // If the sidebar container does not exist, create it
  if (!summarizer) {

    // Create a new div element to serve as the summarizer sidebar container and prepend it to the passed in parent element
    summarizer = document.createElement('div');
    summarizer.id = 'yt-summarizer-sidebar-container';
    parentElement.prepend(summarizer); // empty div at this point
  }

  // if no react root for the summarizer sidebar - create it
  if (!summarizerRoot) {
    summarizerRoot = createRoot(summarizer); // createRoot allows you create a root which acts as the entry point where a React application or component is rendered into the DOM, if already exists we simply continue
  }

  // Update the summarizer container div by rendering the Sidebar component with the passed in video details, when content script runs on a new video page, react will update by passing in the new video details, and rendering a new Sidebar component
  summarizerRoot.render(<Sidebar title={title} transcript={transcript} videoId={videoId} />);

}