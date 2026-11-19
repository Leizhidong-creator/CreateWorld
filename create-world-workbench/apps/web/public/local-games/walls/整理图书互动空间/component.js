(function () {
"use strict";
const runtime = window.BeyondWallsReactRuntime;
const source = window.BeyondWallsMiniGameSources && window.BeyondWallsMiniGameSources.bookshelf;
if (!runtime) throw new Error("Missing shared React runtime for bookshelf");
if (!source) throw new Error("Missing mini-game source: bookshelf");

window.BeyondWallsMiniGames = window.BeyondWallsMiniGames || {};
window.BeyondWallsMiniGames.bookshelf = {
  mount(rootElement, options) {
    if (!rootElement) throw new Error("Missing mini-game root: bookshelf");
    source.setMountOptions(options);
    const reactRoot = runtime.ReactDOM.createRoot(rootElement);
    reactRoot.render(runtime.jsxRuntime.jsx(source.Component, {}));
    let destroyed = false;
    return {
      get api() { return source.getApi(); },
      destroy() {
        if (destroyed) return;
        destroyed = true;
        reactRoot.unmount();
        source.clearMountOptions();
      }
    };
  }
};
})();
