'use strict';

// Reinstall safely: undo the previous adapter before attaching another one.
window.GOA2Mobile2D?.destroy();
if (new URLSearchParams(location.search).get('3d') !== '0') return;
window.GOA2Mobile?.destroy();
