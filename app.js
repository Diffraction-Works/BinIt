/**
 * BinIt - Thought Processing Web Application
 * Main Application Logic
 */

// ============================================
// Constants & Configuration
// ============================================
const DB_NAME = 'binit-db';
const DB_VERSION = 1;
const STORE_NAME = 'thoughts';
const LOCALSTORAGE_KEY = 'binit-thoughts';

// ============================================
// Magic Numbers as Constants
// ============================================
const TIMING = {
    ANIMATION_DELAY: 400,          // Card swallow animation duration
    PARTICLE_REMOVAL: 2000,         // Particle CSS animation duration
    TOAST_DURATION: 3000,           // Default toast display duration
    TOAST_FADE_OUT: 300,            // Toast fade out duration
    BURN_ANIMATION: 500,            // Burn animation duration
    DRAG_IMAGE_DELAY: 0
};

const PARTICLE = {
    DEFAULT_COUNT: 40,
    BURN_COUNT: 50,
    MIN_SIZE: 4,
    MAX_SIZE: 12,
    MIN_VELOCITY: 50,
    MAX_VELOCITY: 200,
    GRAY_MIN: 100,
    GRAY_MAX: 200
};

const TEXT = {
    TRUNCATE_LENGTH: 100,
    MAX_INPUT_LENGTH: 500
};

// Status enum
const Status = {
    ACTIVE: 'active',
    PENDING_REVIEW: 'pending_review',
    BURNED: 'burned',
    PRESERVED: 'preserved'
};

// ============================================
// Centralized Data Cache (Issue #5 Fix)
// ============================================
const DataCache = {
    _cache: null,
    _cacheTimestamp: 0,
    CACHE_TTL: 5000, // 5 seconds cache TTL
    
    async getThoughts() {
        const now = Date.now();
        if (this._cache && (now - this._cacheTimestamp) < this.CACHE_TTL) {
            return this._cache;
        }
        
        const thoughts = await getAllThoughts();
        this._cache = thoughts;
        this._cacheTimestamp = now;
        return thoughts;
    },
    
    invalidate() {
        this._cache = null;
        this._cacheTimestamp = 0;
    },
    
    async getByStatus(status) {
        const all = await this.getThoughts();
        return all.filter(t => t.status === status);
    },
    
    async findById(id) {
        const all = await this.getThoughts();
        return all.find(t => t.id === id);
    }
};

// ============================================
// Loading State Manager (Issue #11 Fix)
// ============================================
const LoadingState = {
    _states: {},
    
    set(key, isLoading) {
        this._states[key] = isLoading;
        this._updateUI();
    },
    
    isLoading(key) {
        return this._states[key] || false;
    },
    
    _updateUI() {
        const anyLoading = Object.values(this._states).some(v => v);
        document.body.classList.toggle('loading', anyLoading);
    },
    
    async wrap(key, promise) {
        this.set(key, true);
        try {
            return await promise;
        } finally {
            this.set(key, false);
        }
    }
};

// ============================================
// Keyboard Drag State (Issue #12 Fix)
// ============================================
const KeyboardDragState = {
    active: false,
    currentCard: null,
    targetZone: null
};

// ============================================
// State Management
// ============================================
let db = null;
let useIndexedDB = true;
let currentMonth = new Date();
let thoughts = [];
let dragCompleted = false; // Issue #7: Track if drag was successful

// DOM Elements
const elements = {
    thoughtInput: document.getElementById('thoughtInput'),
    charCount: document.getElementById('charCount'),
    retentionPeriod: document.getElementById('retentionPeriod'),
    crumpleBtn: document.getElementById('crumpleBtn'),
    activeThoughts: document.getElementById('activeThoughts'),
    emptyActive: document.getElementById('emptyActive'),
    trashContainer: document.getElementById('trashContainer'),
    trashCan: document.getElementById('trashCan'),
    trashCount: document.getElementById('trashCount'),
    pendingBadge: document.getElementById('pendingBadge'),
    pendingThoughts: document.getElementById('pendingThoughts'),
    emptyPending: document.getElementById('emptyPending'),
    memorialThoughts: document.getElementById('memorialThoughts'),
    emptyMemorial: document.getElementById('emptyMemorial'),
    calendarGrid: document.getElementById('calendarGrid'),
    currentMonth: document.getElementById('currentMonth'),
    prevMonth: document.getElementById('prevMonth'),
    nextMonth: document.getElementById('nextMonth'),
    particleContainer: document.getElementById('particleContainer'),
    toastContainer: document.getElementById('toastContainer'),
    tabBtns: document.querySelectorAll('.tab-btn'),
    tabPanels: document.querySelectorAll('.tab-panel')
};

// ============================================
// Database Initialization
// ============================================
async function initDatabase() {
    try {
        // Try IndexedDB first
        if ('indexedDB' in window) {
            db = await openIndexedDB();
            useIndexedDB = true;
            console.log('Using IndexedDB');
            return;
        }
    } catch (e) {
        console.warn('IndexedDB not available, falling back to localStorage');
    }
    
    // Fallback to localStorage
    useIndexedDB = false;
    loadFromLocalStorage();
    console.log('Using localStorage');
}

function openIndexedDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        
        request.onupgradeneeded = (event) => {
            const database = event.target.result;
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                const store = database.createObjectStore(STORE_NAME, {
                    keyPath: 'id',
                    autoIncrement: false
                });
                store.createIndex('status', 'status', { unique: false });
                store.createIndex('createdAt', 'createdAt', { unique: false });
                store.createIndex('destructionDate', 'destructionDate', { unique: false });
            }
        };
    });
}

// ============================================
// CRUD Operations
// ============================================
async function createThought(text, retentionPeriod) {
    const now = Date.now();
    const thought = {
        id: generateUUID(),
        text: text.trim(),
        createdAt: now,
        destructionDate: now + (retentionPeriod * 24 * 60 * 60 * 1000),
        retentionPeriod: parseInt(retentionPeriod),
        status: Status.ACTIVE,
        burnedAt: null,
        preservedAt: null
    };
    
    if (useIndexedDB) {
        try {
            return new Promise((resolve, reject) => {
                const transaction = db.transaction([STORE_NAME], 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.add(thought);
                request.onsuccess = () => resolve(thought);
                request.onerror = () => reject(request.error);
            });
        } catch (e) {
            console.error('Failed to create thought in IndexedDB:', e);
            showToast('Failed to save thought');
            throw e;
        }
    } else {
        thoughts.push(thought);
        saveToLocalStorage();
        return thought;
    }
}

async function getAllThoughts() {
    if (useIndexedDB) {
        try {
            return new Promise((resolve, reject) => {
                const transaction = db.transaction([STORE_NAME], 'readonly');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        } catch (e) {
            console.error('Failed to get thoughts from IndexedDB:', e);
            showToast('Failed to load thoughts');
            return [];
        }
    } else {
        return thoughts;
    }
}

async function updateThought(thought) {
    if (useIndexedDB) {
        try {
            return new Promise((resolve, reject) => {
                const transaction = db.transaction([STORE_NAME], 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.put(thought);
                request.onsuccess = () => resolve(thought);
                request.onerror = () => reject(request.error);
            });
        } catch (e) {
            console.error('Failed to update thought in IndexedDB:', e);
            showToast('Failed to update thought');
            throw e;
        }
    } else {
        const index = thoughts.findIndex(t => t.id === thought.id);
        if (index !== -1) {
            thoughts[index] = thought;
            saveToLocalStorage();
        }
        return thought;
    }
}

async function deleteThought(id) {
    if (useIndexedDB) {
        try {
            return new Promise((resolve, reject) => {
                const transaction = db.transaction([STORE_NAME], 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.delete(id);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        } catch (e) {
            console.error('Failed to delete thought from IndexedDB:', e);
            showToast('Failed to delete thought');
            throw e;
        }
    } else {
        thoughts = thoughts.filter(t => t.id !== id);
        saveToLocalStorage();
    }
}

async function getThoughtsByStatus(status) {
    const all = await getAllThoughts();
    return all.filter(t => t.status === status);
}

// ============================================
// LocalStorage Fallback
// ============================================
function loadFromLocalStorage() {
    try {
        const stored = localStorage.getItem(LOCALSTORAGE_KEY);
        thoughts = stored ? JSON.parse(stored) : [];
    } catch (e) {
        thoughts = [];
    }
}

function saveToLocalStorage() {
    try {
        localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(thoughts));
    } catch (e) {
        console.error('Failed to save to localStorage:', e);
        // Issue #10: User-visible error notification for localStorage failures
        if (e.name === 'QuotaExceededError') {
            showToast('Storage full! Please preserve or burn some thoughts to continue saving.');
        } else {
            showToast('Failed to save data. Your changes may not persist.');
        }
    }
}

// ============================================
// Utility Functions
// ============================================
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function formatDate(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

function getDaysUntil(timestamp) {
    const now = Date.now();
    const diff = timestamp - now;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// Issue #9 Fix: Use TEXT constants
function truncateText(text, maxLength = TEXT.TRUNCATE_LENGTH) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Escapes special CSS selector characters to prevent XSS in querySelector
 * Uses CSS.escape() if available, with fallback for older browsers
 */
function escapeCssSelector(value) {
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
        return CSS.escape(value);
    }
    // Manual fallback for older browsers
    return value.replace(/(["'\[\]\(\)=~\|\^\$\*\?\+\@:\.\/\\ ])/g, '\\$1');
}

// ============================================
// Toast Notifications
// ============================================
// Issue #11 Fix: Enhanced toast with loading state support
function showToast(message, duration = TIMING.TOAST_DURATION) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    elements.toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), TIMING.TOAST_FADE_OUT);
    }, duration);
}

// Issue #11 Fix: Loading toast for async operations
function showLoadingToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast loading-toast';
    toast.innerHTML = `<span class="loading-spinner"></span>${message}`;
    elements.toastContainer.appendChild(toast);
    return toast;
}

function hideLoadingToast(toast) {
    if (toast) {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), TIMING.TOAST_FADE_OUT);
    }
}

// ============================================
// Particle Effects
// ============================================
// Issue #9 Fix: Use constants for magic numbers
function createParticles(x, y, count = PARTICLE.DEFAULT_COUNT) {
    const container = elements.particleContainer;
    
    for (let i = 0; i < count; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        
        const size = Math.random() * (PARTICLE.MAX_SIZE - PARTICLE.MIN_SIZE) + PARTICLE.MIN_SIZE;
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
        const velocity = Math.random() * (PARTICLE.MAX_VELOCITY - PARTICLE.MIN_VELOCITY) + PARTICLE.MIN_VELOCITY;
        const tx = Math.cos(angle) * velocity;
        const ty = Math.sin(angle) * velocity - 100;
        
        // Grayscale colors
        const gray = Math.floor(Math.random() * (PARTICLE.GRAY_MAX - PARTICLE.GRAY_MIN) + PARTICLE.GRAY_MIN);
        const color = `rgb(${gray}, ${gray}, ${gray})`;
        
        particle.style.cssText = `
            left: ${x}px;
            top: ${y}px;
            width: ${size}px;
            height: ${size}px;
            background: ${color};
            --tx: ${tx}px;
            --ty: ${ty}px;
        `;
        
        container.appendChild(particle);
        
        setTimeout(() => particle.remove(), TIMING.PARTICLE_REMOVAL);
    }
}

// ============================================
// Thought Card Rendering
// ============================================
// Issue #12 Fix: Add keyboard support for drag & drop
function createThoughtCard(thought) {
    const card = document.createElement('div');
    card.className = 'thought-card';
    card.dataset.id = thought.id;
    card.draggable = true;
    card.tabIndex = 0; // Make focusable for keyboard
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `Thought: ${truncateText(thought.text, 50)}`);
    
    const daysUntil = getDaysUntil(thought.destructionDate);
    const daysText = daysUntil > 0 
        ? `${daysUntil} days left` 
        : daysUntil === 0 
            ? 'Due today' 
            : 'Ready for review';
    
    card.innerHTML = `
        <div class="thought-status ${thought.status}"></div>
        <div class="thought-card-content">
            <p class="thought-text">${truncateText(escapeHtml(thought.text))}</p>
        </div>
        <div class="thought-meta">
            <span class="thought-date">${formatDate(thought.createdAt)}</span>
            <span class="thought-days">${daysText}</span>
        </div>
    `;
    
    // Drag events
    card.addEventListener('dragstart', handleDragStart);
    card.addEventListener('dragend', handleDragEnd);
    
    // Issue #12 Fix: Keyboard events for accessibility
    card.addEventListener('keydown', handleCardKeyDown);
    
    return card;
}

// Issue #12 Fix: Keyboard handler for drag & drop
function handleCardKeyDown(e) {
    const card = e.target.closest('.thought-card');
    if (!card) return;
    
    const thoughtId = card.dataset.id;
    
    switch (e.key) {
        case 'Enter':
        case ' ':
            e.preventDefault();
            if (!KeyboardDragState.active) {
                // Start keyboard drag mode
                startKeyboardDrag(card, thoughtId);
            } else {
                // Complete keyboard drag
                completeKeyboardDrag(thoughtId);
            }
            break;
        case 'Escape':
            if (KeyboardDragState.active) {
                cancelKeyboardDrag();
            }
            break;
        case 'ArrowRight':
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'ArrowDown':
            if (KeyboardDragState.active) {
                e.preventDefault();
                moveKeyboardDrag(card, e.key);
            }
            break;
    }
}

// Issue #12 Fix: Start keyboard drag mode
function startKeyboardDrag(card, thoughtId) {
    KeyboardDragState.active = true;
    KeyboardDragState.currentCard = card;
    card.classList.add('keyboard-dragging');
    
    // Show trash container during keyboard drag
    elements.trashContainer.classList.remove('hidden');
    
    showToast('Use arrow keys to move. Press Enter to drop in trash.');
}

// Issue #12 Fix: Move card with keyboard
function moveKeyboardDrag(card, direction) {
    const trashZone = elements.trashContainer;
    
    if (direction === 'ArrowRight' || direction === 'ArrowDown') {
        trashZone.classList.add('hovering');
        trashZone.classList.add('keyboard-target');
        KeyboardDragState.targetZone = 'trash';
    } else {
        trashZone.classList.remove('hovering');
        trashZone.classList.remove('keyboard-target');
        KeyboardDragState.targetZone = null;
    }
}

// Issue #12 Fix: Complete keyboard drag
async function completeKeyboardDrag(thoughtId) {
    cancelKeyboardDrag();
    
    const card = document.querySelector(`.thought-card[data-id="${escapeCssSelector(thoughtId)}"]`);
    if (card && KeyboardDragState.targetZone === 'trash') {
        // Simulate drop into trash
        await handleTrashDrop(thoughtId, card);
    }
}

// Issue #12 Fix: Cancel keyboard drag
function cancelKeyboardDrag() {
    if (KeyboardDragState.currentCard) {
        KeyboardDragState.currentCard.classList.remove('keyboard-dragging');
    }
    
    elements.trashContainer.classList.remove('hovering');
    elements.trashContainer.classList.remove('keyboard-target');
    
    KeyboardDragState.active = false;
    KeyboardDragState.currentCard = null;
    KeyboardDragState.targetZone = null;
    
    // Hide trash container when drag is cancelled
    elements.trashContainer.classList.add('hidden');
}

// Issue #5 Fix: Use DataCache to avoid redundant database queries
// Issue #8 Fix: Standardize to async/await pattern
async function renderActiveThoughts() {
    elements.activeThoughts.innerHTML = '';
    LoadingState.set('activeThoughts', true);
    
    try {
        const activeThoughts = await DataCache.getByStatus(Status.ACTIVE);
        
        if (activeThoughts.length === 0) {
            elements.emptyActive.classList.remove('hidden');
        } else {
            elements.emptyActive.classList.add('hidden');
            activeThoughts.forEach(thought => {
                elements.activeThoughts.appendChild(createThoughtCard(thought));
            });
        }
    } catch (error) {
        console.error('Failed to render active thoughts:', error);
        showToast('Failed to load thoughts');
    } finally {
        LoadingState.set('activeThoughts', false);
    }
}

// ============================================
// Drag & Drop with Crumple Physics
// ============================================
let draggedCard = null;
let dragOffset = { x: 0, y: 0 };
let originalPosition = { x: 0, y: 0 };

function handleDragStart(e) {
    draggedCard = e.target.closest('.thought-card');
    if (!draggedCard) return;
    
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggedCard.dataset.id);
    
    // Add crumple class
    draggedCard.classList.add('crumpling');
    
    // Show trash container during drag
    elements.trashContainer.classList.remove('hidden');
    
    // Calculate offset
    const rect = draggedCard.getBoundingClientRect();
    dragOffset.x = e.clientX - rect.left;
    dragOffset.y = e.clientY - rect.top;
    
    // Set drag image (optional)
    setTimeout(() => {
        draggedCard.classList.add('dragging');
        draggedCard.classList.add('crumpled');
    }, 0);
}

// Issue #7 Fix: Only hide trash container after successful drop
function handleDragEnd(e) {
    if (!draggedCard) return;
    
    draggedCard.classList.remove('dragging', 'crumpling', 'crumpled');
    draggedCard = null;
    
    elements.trashContainer.classList.remove('hovering');
    elements.trashCan.classList.remove('drag-over');
    
    // Issue #7 Fix: Only hide trash container if drag was NOT completed successfully
    // The dragCompleted flag is set to true in the drop handler before hiding
    if (!dragCompleted) {
        elements.trashContainer.classList.add('hidden');
    }
    dragCompleted = false; // Reset for next drag
}

// ============================================
// Trash Can Drop Handling
// ============================================
function initTrashCan() {
    const trashCan = elements.trashCan;
    const container = elements.trashContainer;
    
    trashCan.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        container.classList.add('hovering');
        trashCan.classList.add('drag-over');
    });
    
    trashCan.addEventListener('dragleave', () => {
        container.classList.remove('hovering');
        trashCan.classList.remove('drag-over');
    });
    
    // Issue #3 & #7 Fix: Proper async handling and drag completion tracking
trashCan.addEventListener('drop', async (e) => {
        e.preventDefault();
        container.classList.remove('hovering');
        trashCan.classList.remove('drag-over');
        
        const thoughtId = e.dataTransfer.getData('text/plain');
        if (!thoughtId) return;
        
        const card = document.querySelector(`.thought-card[data-id="${escapeCssSelector(thoughtId)}"]`);
        if (card) {
            // Animate swallow
            card.classList.add('swallowed');
            
            // Issue #3 Fix: Use TIMING constant and proper async flow
            setTimeout(async () => {
                // Fetch thought inside setTimeout to avoid stale data
                const allThoughts = await getAllThoughts();
                const thought = allThoughts.find(t => t.id === thoughtId);
                
                if (thought) {
                    try {
                        // Issue #3 Fix: Wait for database update BEFORE removing DOM
                        thought.status = Status.PENDING_REVIEW;
                        await updateThought(thought);
                        
                        // Issue #7 Fix: Mark drag as completed before DOM removal
                        dragCompleted = true;
                        
                        // Invalidate cache after successful update
                        DataCache.invalidate();
                        
                        showToast('Thought moved to trash');
                        renderActiveThoughts();
                        updateTrashCount();
                        checkPendingReviews();
                        
                        // Only remove card from DOM after successful database update
                        card.remove();
                    } catch (error) {
                        console.error('Failed to move thought to trash:', error);
                        showToast('Failed to move thought to trash');
                        // Issue #3 Fix: Restore card appearance on failure
                        card.classList.remove('swallowed');
                        // Hide trash container on failure
                        elements.trashContainer.classList.add('hidden');
                    }
                }
            }, TIMING.ANIMATION_DELAY);
        }
    });
    
    // Issue #3 Fix: Extract trash drop logic for reuse (keyboard support)
    async function handleTrashDrop(thoughtId, card) {
        card.classList.add('swallowed');
        
        setTimeout(async () => {
            const allThoughts = await getAllThoughts();
            const thought = allThoughts.find(t => t.id === thoughtId);
            
            if (thought) {
                try {
                    thought.status = Status.PENDING_REVIEW;
                    await updateThought(thought);
                    
                    dragCompleted = true;
                    DataCache.invalidate();
                    
                    showToast('Thought moved to trash');
                    renderActiveThoughts();
                    updateTrashCount();
                    checkPendingReviews();
                    
                    card.remove();
                } catch (error) {
                    console.error('Failed to move thought to trash:', error);
                    showToast('Failed to move thought to trash');
                    card.classList.remove('swallowed');
                    elements.trashContainer.classList.add('hidden');
                }
            }
        }, TIMING.ANIMATION_DELAY);
    }
}

// Issue #5 & #8 Fix: Use DataCache and async/await
async function updateTrashCount() {
    try {
        const pending = await DataCache.getByStatus(Status.PENDING_REVIEW);
        elements.trashCount.textContent = pending.length;
        elements.trashCount.style.display = pending.length > 0 ? 'flex' : 'none';
    } catch (error) {
        console.error('Failed to update trash count:', error);
    }
}

// ============================================
// Pending Review Management
// ============================================
// Issue #4 Fix: Batch update using single IndexedDB transaction
async function checkPendingReviews() {
    const now = Date.now();
    
    // Issue #5 Fix: Use DataCache for consistent data access
    const all = await DataCache.getThoughts();
    const thoughtsToUpdate = all.filter(
        thought => thought.status === Status.ACTIVE && thought.destructionDate <= now
    );
    
    if (thoughtsToUpdate.length > 0) {
        try {
            if (useIndexedDB) {
                // Issue #4 Fix: Use single transaction for batch update
                await batchUpdateThoughts(thoughtsToUpdate.map(t => ({
                    ...t,
                    status: Status.PENDING_REVIEW
                })));
            } else {
                // localStorage fallback: update in memory and save once
                for (const thought of thoughtsToUpdate) {
                    const index = thoughts.findIndex(t => t.id === thought.id);
                    if (index !== -1) {
                        thoughts[index].status = Status.PENDING_REVIEW;
                    }
                }
                saveToLocalStorage();
            }
            
            // Invalidate cache after batch update
            DataCache.invalidate();
        } catch (error) {
            console.error('Failed to batch update thoughts:', error);
            showToast('Some thoughts failed to update');
        }
    }
    
    renderPendingReviews();
    updatePendingBadge();
    renderCalendar();
}

// Issue #4 Fix: Batch update multiple thoughts in single transaction
async function batchUpdateThoughts(thoughtsToUpdate) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        let completed = 0;
        let hasError = false;
        
        transaction.oncomplete = () => {
            if (!hasError) resolve();
        };
        
        transaction.onerror = () => {
            hasError = true;
            reject(transaction.error);
        };
        
        for (const thought of thoughtsToUpdate) {
            const request = store.put(thought);
            request.onsuccess = () => {
                completed++;
                if (completed === thoughtsToUpdate.length && !hasError) {
                    resolve();
                }
            };
            request.onerror = () => {
                hasError = true;
                reject(request.error);
            };
        }
    });
}

// Issue #5 & #8 Fix: Use DataCache and async/await
async function updatePendingBadge() {
    try {
        const pending = await DataCache.getByStatus(Status.PENDING_REVIEW);
        elements.pendingBadge.textContent = pending.length;
        elements.pendingBadge.classList.toggle('hidden', pending.length === 0);
    } catch (error) {
        console.error('Failed to update pending badge:', error);
    }
}

// Issue #5 & #8 Fix: Use DataCache and async/await
async function renderPendingReviews() {
    elements.pendingThoughts.innerHTML = '';
    LoadingState.set('pendingReviews', true);
    
    try {
        const pending = await DataCache.getByStatus(Status.PENDING_REVIEW);
        
        if (pending.length === 0) {
            elements.emptyPending.classList.remove('hidden');
        } else {
            elements.emptyPending.classList.add('hidden');
            
            pending.forEach(thought => {
                const item = document.createElement('div');
                item.className = 'pending-item';
                item.innerHTML = `
                    <p class="pending-text">${escapeHtml(thought.text)}</p>
                    <div class="pending-meta">
                        <span>Discarded: ${formatDate(thought.createdAt)}</span>
                        <span>Retention: ${thought.retentionPeriod} days</span>
                    </div>
                    <div class="pending-actions">
                        <button class="action-btn burn-btn" data-id="${thought.id}">
                            Burn
                        </button>
                        <button class="action-btn preserve-btn" data-id="${thought.id}">
                            Preserve
                        </button>
                    </div>
                `;
                
                // Add event listeners
                item.querySelector('.burn-btn').addEventListener('click', () => burnThought(thought.id, item));
                item.querySelector('.preserve-btn').addEventListener('click', () => preserveThought(thought.id, item));
                
                elements.pendingThoughts.appendChild(item);
            });
        }
    } catch (error) {
        console.error('Failed to render pending reviews:', error);
        showToast('Failed to load pending reviews');
    } finally {
        LoadingState.set('pendingReviews', false);
    }
}

// Issue #8 & #9 Fix: Use async/await and constants
async function burnThought(id, element) {
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    
    // Create particles - Issue #9 Fix: Use constant
    createParticles(x, y, PARTICLE.BURN_COUNT);
    
    // Fade out element - Issue #9 Fix: Use constant
    element.style.transition = `opacity ${TIMING.BURN_ANIMATION}ms, transform ${TIMING.BURN_ANIMATION}ms`;
    element.style.opacity = '0';
    element.style.transform = 'scale(0.8)';
    
    // Issue #11 Fix: Show loading state
    const loadingToast = showLoadingToast('Burning thought...');
    
    setTimeout(async () => {
        try {
            await deleteThought(id);
            DataCache.invalidate();
            CalendarCache.invalidate();
            
            hideLoadingToast(loadingToast);
            showToast('Thought burned - released forever');
            renderPendingReviews();
            updateTrashCount();
            renderMemorial();
        } catch (error) {
            hideLoadingToast(loadingToast);
            console.error('Failed to burn thought:', error);
            showToast('Failed to burn thought');
            element.style.opacity = '1';
            element.style.transform = 'scale(1)';
        }
    }, TIMING.BURN_ANIMATION);
}

// Issue #5 & #8 Fix: Use DataCache and async/await
async function preserveThought(id, element) {
    LoadingState.set('preserve', true);
    
    try {
        const thought = await DataCache.findById(id);
        
        if (thought) {
            thought.status = Status.PRESERVED;
            thought.preservedAt = Date.now();
            await updateThought(thought);
            
            DataCache.invalidate();
            CalendarCache.invalidate();
            
            showToast('Thought preserved as memory');
            renderPendingReviews();
            renderMemorial();
            updateTrashCount();
        }
    } catch (error) {
        console.error('Failed to preserve thought:', error);
        showToast('Failed to preserve thought');
    } finally {
        LoadingState.set('preserve', false);
    }
}

// ============================================
// Memorial Section
// ============================================
// Issue #5 & #8 Fix: Use DataCache and async/await
async function renderMemorial() {
    elements.memorialThoughts.innerHTML = '';
    LoadingState.set('memorial', true);
    
    try {
        const memories = await DataCache.getByStatus(Status.PRESERVED);
        
        if (memories.length === 0) {
            elements.emptyMemorial.classList.remove('hidden');
        } else {
            elements.emptyMemorial.classList.add('hidden');
            
            memories.forEach(thought => {
                const card = document.createElement('div');
                card.className = 'memory-card';
                card.innerHTML = `
                    <button class="memory-delete" data-id="${thought.id}">×</button>
                    <div class="memory-title">Memory</div>
                    <p class="memory-text">${escapeHtml(thought.text)}</p>
                    <div class="memory-date">Preserved: ${formatDate(thought.preservedAt)}</div>
                `;
                
                card.querySelector('.memory-delete').addEventListener('click', async () => {
                    if (confirm('Permanently delete this memory?')) {
                        await deleteThought(thought.id);
                        DataCache.invalidate();
                        renderMemorial();
                        showToast('Memory deleted');
                    }
                });
                
                elements.memorialThoughts.appendChild(card);
            });
        }
    } catch (error) {
        console.error('Failed to render memorial:', error);
        showToast('Failed to load memories');
    } finally {
        LoadingState.set('memorial', false);
    }
}

// ============================================
// Calendar/Timeline View
// ============================================

// Issue #6 Fix: Calendar memoization cache
const CalendarCache = {
    _cache: new Map(),
    
    _getKey(year, month) {
        return `${year}-${month}`;
    },
    
    get(year, month) {
        return this._cache.get(this._getKey(year, month));
    },
    
    set(year, month, html) {
        // Limit cache size to 12 months
        if (this._cache.size >= 12) {
            const firstKey = this._cache.keys().next().value;
            this._cache.delete(firstKey);
        }
        this._cache.set(this._getKey(year, month), html);
    },
    
    invalidate() {
        this._cache.clear();
    }
};

// Issue #5, #6, #8 Fix: Use DataCache, memoization, and async/await
async function renderCalendar() {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const cacheKey = CalendarCache._getKey(year, month);
    
    // Update header
    elements.currentMonth.textContent = new Date(year, month).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric'
    });
    
    LoadingState.set('calendar', true);
    
    try {
        // Issue #6 Fix: Check cache first
        const cachedHtml = CalendarCache.get(year, month);
        if (cachedHtml) {
            elements.calendarGrid.innerHTML = cachedHtml;
            LoadingState.set('calendar', false);
            return;
        }
        
        // Get all thoughts using cache
        const allThoughts = await DataCache.getThoughts();
        
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDay = firstDay.getDay();
        const daysInMonth = lastDay.getDate();
        
        const today = new Date();
        const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
        
        let html = '';
        
        // Day headers
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        dayNames.forEach(day => {
            html += `<div class="calendar-day-header">${day}</div>`;
        });
        
        // Previous month days
        const prevMonth = new Date(year, month, 0);
        const prevDays = prevMonth.getDate();
        for (let i = startDay - 1; i >= 0; i--) {
            const day = prevDays - i;
            html += `<div class="calendar-day other-month">${day}</div>`;
        }
        
        // Current month days
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const timestamp = date.getTime();
            
            // Check for thoughts on this day
            const hasActive = allThoughts.some(t => 
                t.status === Status.ACTIVE && 
                isSameDay(new Date(t.destructionDate), date)
            );
            const hasPending = allThoughts.some(t => 
                t.status === Status.PENDING_REVIEW && 
                isSameDay(new Date(t.destructionDate), date)
            );
            const hasPreserved = allThoughts.some(t => 
                t.status === Status.PRESERVED && 
                t.preservedAt && isSameDay(new Date(t.preservedAt), date)
            );
            
            let classes = 'calendar-day';
            if (isCurrentMonth && today.getDate() === day) classes += ' today';
            if (hasActive || hasPending || hasPreserved) {
                classes += ' has-thoughts';
                if (hasPending) classes += ' has-pending';
                else if (hasPreserved) classes += ' has-preserved';
            }
            
            html += `<div class="${classes}">${day}</div>`;
        }
        
        // Next month days
        const totalCells = startDay + daysInMonth;
        const remainingCells = 7 - (totalCells % 7);
        if (remainingCells < 7) {
            for (let day = 1; day <= remainingCells; day++) {
                html += `<div class="calendar-day other-month">${day}</div>`;
            }
        }
        
        // Issue #6 Fix: Cache the rendered HTML
        CalendarCache.set(year, month, html);
        elements.calendarGrid.innerHTML = html;
    } catch (error) {
        console.error('Failed to render calendar:', error);
        showToast('Failed to load calendar');
    } finally {
        LoadingState.set('calendar', false);
    }
}

function isSameDay(date1, date2) {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
}

// ============================================
// Tab Navigation
// ============================================
// Issue #8 Fix: Standardize to async/await
function initTabs() {
    const mainContent = document.querySelector('.main-content');
    const tabPanelsContainer = document.getElementById('tabPanels');
    
    elements.tabBtns.forEach(btn => {
        btn.addEventListener('click', async () => {
            const tab = btn.dataset.tab;
            
            // Update buttons
            elements.tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Handle main content visibility
            if (tab === 'home') {
                mainContent.classList.remove('view-hidden');
                tabPanelsContainer.classList.remove('active');
            } else {
                mainContent.classList.add('view-hidden');
                tabPanelsContainer.classList.add('active');
            }
            
            // Update panels
            elements.tabPanels.forEach(panel => {
                panel.classList.toggle('active', panel.id === `${tab}Panel`);
            });
            
            // Refresh content based on tab
            if (tab === 'timeline') renderCalendar();
            else if (tab === 'pending') renderPendingReviews();
            else if (tab === 'memorial') renderMemorial();
            else if (tab === 'home') renderActiveThoughts();
        });
    });
}

// ============================================
// Input Handling
// ============================================
function initInput() {
    // Character count
    elements.thoughtInput.addEventListener('input', () => {
        elements.charCount.textContent = elements.thoughtInput.value.length;
    });
    
    // Submit thought
    elements.crumpleBtn.addEventListener('click', async () => {
        const text = elements.thoughtInput.value.trim();
        const retention = elements.retentionPeriod.value;
        
        if (!text) {
            showToast('Please write a thought first');
            return;
        }
        
        // Issue #11 Fix: Show loading state
        const loadingToast = showLoadingToast('Capturing thought...');
        
        try {
            await createThought(text, retention);
            
            // Invalidate caches after creating new thought
            DataCache.invalidate();
            CalendarCache.invalidate();
            
            // Reset input
            elements.thoughtInput.value = '';
            elements.charCount.textContent = '0';
            
            hideLoadingToast(loadingToast);
            showToast('Thought captured and discarded');
            renderActiveThoughts();
        } catch (error) {
            hideLoadingToast(loadingToast);
            console.error('Failed to create thought:', error);
            showToast('Failed to capture thought');
        }
    });
}

// ============================================
// Calendar Navigation
// ============================================
function initCalendarNav() {
    elements.prevMonth.addEventListener('click', () => {
        currentMonth.setMonth(currentMonth.getMonth() - 1);
        // Issue #6 Fix: Calendar will use cache if available
        renderCalendar();
    });
    
    elements.nextMonth.addEventListener('click', () => {
        currentMonth.setMonth(currentMonth.getMonth() + 1);
        // Issue #6 Fix: Calendar will use cache if available
        renderCalendar();
    });
}

// ============================================
// App Initialization
// ============================================
async function init() {
    console.log('Initializing BinIt...');
    
    // Issue #11 Fix: Show initial loading state
    const initLoadingToast = showLoadingToast('Loading BinIt...');
    
    try {
        // Initialize database
        await initDatabase();
        
        // Invalidate all caches on init
        DataCache.invalidate();
        CalendarCache.invalidate();
        
        // Check for pending reviews (auto-update status)
        await checkPendingReviews();
        
        // Initialize UI components
        initInput();
        initTabs();
        initTrashCan();
        initCalendarNav();
        
        // Hide trash container by default (only shown during drag)
        elements.trashContainer.classList.add('hidden');
        
        // Initial renders
        await Promise.all([
            renderActiveThoughts(),
            renderCalendar(),
            updateTrashCount()
        ]);
        
        hideLoadingToast(initLoadingToast);
        console.log('BinIt ready!');
    } catch (error) {
        hideLoadingToast(initLoadingToast);
        console.error('Failed to initialize BinIt:', error);
        showToast('Failed to initialize app. Please refresh.');
    }
}

// Start app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

