// Register Service Worker for offline support
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/service-worker.js')
            .then(function(registration) {
                console.log('SW registered:', registration.scope);

                // Don't rely on the browser's own background update
                // check (can be delayed up to ~24h) — that delay is
                // what let some users keep running an old, stale
                // build (with outdated permission logic, old bug
                // fixes, etc.) long after a new version was deployed.
                // Force an immediate check now, then keep checking
                // periodically while the tab stays open.
                registration.update();
                setInterval(function () {
                    registration.update();
                }, 60 * 1000);
            })
            .catch(function(error) {
                console.log('SW registration failed:', error);
            });

        // The instant a new service worker takes control (it calls
        // skipWaiting()+clients.claim() in service-worker.js as soon
        // as it activates), reload once so this tab picks up the new
        // app bundle right away — instead of continuing to run the
        // old JS already loaded in memory until the next manual
        // refresh, which is what caused already-open sessions to
        // silently keep stale behavior (wrong nav items, old bug
        // fixes missing, etc.) after a deploy.
        var swRefreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', function () {
            if (swRefreshing) return;
            swRefreshing = true;
            window.location.reload();
        });
    });
}
