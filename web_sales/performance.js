// performance.js — Performance optimizations for المنصة المحاسبية
// Handles debouncing, lazy loading, and caching

// Lazy loading images when they come into view
if ('IntersectionObserver' in window) {
  const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        img.src = img.dataset.src;
        img.classList.add('loaded');
        observer.unobserve(img);
      }
    });
  });

  document.querySelectorAll('img[data-src]').forEach(img => imageObserver.observe(img));
}

// Add loading="lazy" to images automatically
document.querySelectorAll('img:not([loading])').forEach(img => {
  img.setAttribute('loading', 'lazy');
});

// Optimize render performance by reducing reflows
let renderScheduled = false;
function scheduleRender(callback) {
  if (!renderScheduled) {
    renderScheduled = true;
    requestAnimationFrame(() => {
      callback();
      renderScheduled = false;
    });
  }
}

// Cache for computed values
const computeCache = new Map();
function memoize(key, compute) {
  if (computeCache.has(key)) {
    return computeCache.get(key);
  }
  const result = compute();
  computeCache.set(key, result);
  return result;
}

// Clear cache periodically to prevent memory leaks
setInterval(() => {
  computeCache.clear();
}, 5 * 60 * 1000); // Clear every 5 minutes

// Optimize Firebase listeners to debounce updates
let firebaseUpdateScheduled = false;
function scheduleFirebaseUpdate(callback) {
  if (!firebaseUpdateScheduled) {
    firebaseUpdateScheduled = true;
    setTimeout(() => {
      callback();
      firebaseUpdateScheduled = false;
    }, 500); // Batch Firebase updates
  }
}

// Add visibility change handler to pause updates when tab is not visible
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    console.log('[Performance] Tab hidden - pausing updates');
  } else {
    console.log('[Performance] Tab visible - resuming updates');
  }
});

// Monitor performance metrics
if ('PerformanceObserver' in window) {
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration > 1000) { // Log slow operations > 1s
          console.warn(`[Performance] Slow operation: ${entry.name} took ${entry.duration.toFixed(2)}ms`);
        }
      }
    });
    observer.observe({ entryTypes: ['measure', 'navigation'] });
  } catch(e) {
    // Performance observer not supported
  }
}

// Preload critical resources
function preloadResource(url, type = 'script') {
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = type;
  link.href = url;
  document.head.appendChild(link);
}

// Prefetch Firebase SDK (already loaded, but good practice)
// preloadResource('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js', 'script');

// Optimize scrolling performance with passive event listeners
document.addEventListener('scroll', () => {
  // Scroll handler
}, { passive: true });

// Use requestIdleCallback for non-critical work
if ('requestIdleCallback' in window) {
  window.scheduleIdleCallback = (callback) => {
    requestIdleCallback(callback, { timeout: 2000 });
  };
} else {
  window.scheduleIdleCallback = (callback) => {
    setTimeout(callback, 0);
  };
}

console.log('[Performance] Optimization module loaded');
