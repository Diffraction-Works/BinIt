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

// Status enum
const Status = {
    ACTIVE: 'active',
    PENDING_REVIEW: 'pending_review',
    BURNED: 'burned',
    PRESERVED: 'preserved'
};

// ============================================
// State Management
// ============================================
let db = null;
let useIndexedDB = true;
let currentMonth = new Date();
let thoughts = [];

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

function truncateText(text, maxLength = 100) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// Toast Notifications
// ============================================
function showToast(message, duration = 3000) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    elements.toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// ============================================
// Particle Effects
// ============================================
function createParticles(x, y, count = 40) {
    const container = elements.particleContainer;
    
    for (let i = 0; i < count; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        
        const size = Math.random() * 8 + 4;
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
        const velocity = Math.random() * 150 + 50;
        const tx = Math.cos(angle) * velocity;
        const ty = Math.sin(angle) * velocity - 100;
        
        // Grayscale colors
        const gray = Math.floor(Math.random() * 100 + 100);
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
        
        setTimeout(() => particle.remove(), 2000);
    }
}

// ============================================
// Thought Card Rendering
// ============================================
function createThoughtCard(thought) {
    const card = document.createElement('div');
    card.className = 'thought-card';
    card.dataset.id = thought.id;
    card.draggable = true;
    
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
    
    return card;
}

function renderActiveThoughts() {
    elements.activeThoughts.innerHTML = '';
    
    getThoughtsByStatus(Status.ACTIVE).then(activeThoughts => {
        if (activeThoughts.length === 0) {
            elements.emptyActive.classList.remove('hidden');
        } else {
            elements.emptyActive.classList.add('hidden');
            activeThoughts.forEach(thought => {
                elements.activeThoughts.appendChild(createThoughtCard(thought));
            });
        }
    });
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

function handleDragEnd(e) {
    if (!draggedCard) return;
    
    draggedCard.classList.remove('dragging', 'crumpling', 'crumpled');
    draggedCard = null;
    
    elements.trashContainer.classList.remove('hovering');
    elements.trashCan.classList.remove('drag-over');
    
    // Hide trash container when drag ends
    elements.trashContainer.classList.add('hidden');
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
    
    trashCan.addEventListener('drop', async (e) => {
        e.preventDefault();
        container.classList.remove('hovering');
        trashCan.classList.remove('drag-over');
        
        const thoughtId = e.dataTransfer.getData('text/plain');
        if (!thoughtId) return;
        
        const card = document.querySelector(`.thought-card[data-id="${thoughtId}"]`);
        if (card) {
            // Animate swallow
            card.classList.add('swallowed');
            
            setTimeout(async () => {
                // Fetch thought inside setTimeout to avoid stale data
                const allThoughts = await getAllThoughts();
                const thought = allThoughts.find(t => t.id === thoughtId);
                
                if (thought) {
                    try {
                        thought.status = Status.PENDING_REVIEW;
                        await updateThought(thought);
                        
                        showToast('Thought moved to trash');
                        renderActiveThoughts();
                        updateTrashCount();
                        checkPendingReviews();
                        
                        // Only remove card from DOM after successful update
                        card.remove();
                    } catch (error) {
                        console.error('Failed to move thought to trash:', error);
                        showToast('Failed to move thought to trash');
                        card.classList.remove('swallowed');
                    }
                }
            }, 400);
        }
    });
}

async function updateTrashCount() {
    const pending = await getThoughtsByStatus(Status.PENDING_REVIEW);
    elements.trashCount.textContent = pending.length;
    elements.trashCount.style.display = pending.length > 0 ? 'flex' : 'none';
}

// ============================================
// Pending Review Management
// ============================================
async function checkPendingReviews() {
    const all = await getAllThoughts();
    const now = Date.now();
    
    // Auto-update status for thoughts past destruction date
    for (const thought of all) {
        if (thought.status === Status.ACTIVE && thought.destructionDate <= now) {
            thought.status = Status.PENDING_REVIEW;
            try {
                await updateThought(thought);
            } catch (error) {
                console.error('Failed to update thought:', error);
            }
        }
    }
    
    renderPendingReviews();
    updatePendingBadge();
    renderCalendar();
}

function updatePendingBadge() {
    getThoughtsByStatus(Status.PENDING_REVIEW).then(pending => {
        elements.pendingBadge.textContent = pending.length;
        elements.pendingBadge.classList.toggle('hidden', pending.length === 0);
    });
}

function renderPendingReviews() {
    elements.pendingThoughts.innerHTML = '';
    
    getThoughtsByStatus(Status.PENDING_REVIEW).then(pending => {
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
    });
}

async function burnThought(id, element) {
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    
    // Create particles
    createParticles(x, y, 50);
    
    // Fade out element
    element.style.transition = 'opacity 0.5s, transform 0.5s';
    element.style.opacity = '0';
    element.style.transform = 'scale(0.8)';
    
    setTimeout(async () => {
        await deleteThought(id);
        showToast('Thought burned - released forever');
        renderPendingReviews();
        updateTrashCount();
        renderMemorial();
    }, 500);
}

async function preserveThought(id, element) {
    const all = await getAllThoughts();
    const thought = all.find(t => t.id === id);
    
    if (thought) {
        thought.status = Status.PRESERVED;
        thought.preservedAt = Date.now();
        await updateThought(thought);
        
        showToast('Thought preserved as memory');
        renderPendingReviews();
        renderMemorial();
        updateTrashCount();
    }
}

// ============================================
// Memorial Section
// ============================================
function renderMemorial() {
    elements.memorialThoughts.innerHTML = '';
    
    getThoughtsByStatus(Status.PRESERVED).then(memories => {
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
                        renderMemorial();
                        showToast('Memory deleted');
                    }
                });
                
                elements.memorialThoughts.appendChild(card);
            });
        }
    });
}

// ============================================
// Calendar/Timeline View
// ============================================
function renderCalendar() {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    // Update header
    elements.currentMonth.textContent = new Date(year, month).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric'
    });
    
    // Get all thoughts
    getAllThoughts().then(allThoughts => {
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
        
        elements.calendarGrid.innerHTML = html;
    });
}

function isSameDay(date1, date2) {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
}

// ============================================
// Tab Navigation
// ============================================
function initTabs() {
    const mainContent = document.querySelector('.main-content');
    const tabPanelsContainer = document.getElementById('tabPanels');
    
    elements.tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
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
        
        await createThought(text, retention);
        
        // Reset input
        elements.thoughtInput.value = '';
        elements.charCount.textContent = '0';
        
        showToast('Thought captured and discarded');
        renderActiveThoughts();
    });
}

// ============================================
// Calendar Navigation
// ============================================
function initCalendarNav() {
    elements.prevMonth.addEventListener('click', () => {
        currentMonth.setMonth(currentMonth.getMonth() - 1);
        renderCalendar();
    });
    
    elements.nextMonth.addEventListener('click', () => {
        currentMonth.setMonth(currentMonth.getMonth() + 1);
        renderCalendar();
    });
}

// ============================================
// App Initialization
// ============================================
async function init() {
    console.log('Initializing BinIt...');
    
    // Initialize database
    await initDatabase();
    
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
    renderActiveThoughts();
    renderCalendar();
    updateTrashCount();
    
    console.log('BinIt ready!');
}

// Start app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

