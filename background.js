// Service worker — keeps extension alive and routes storage requests
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_SETTINGS') {
    chrome.storage.local.get(['chessx_settings'], (result) => {
      sendResponse(result.chessx_settings || null);
    });
    return true;
  }
  if (msg.type === 'SET_SETTINGS') {
    chrome.storage.local.set({ chessx_settings: msg.settings }, () => {
      sendResponse({ ok: true });
    });
    return true;
  }
});
