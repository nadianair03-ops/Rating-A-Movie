import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const API_KEY = '92e5e6a1';
const API_URL = 'https://www.omdbapi.com/';

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyCS11IxswufbX5H5ZR5PuzUEGLxk2hUsc8",
  authDomain: "rating-a-movie.firebaseapp.com",
  projectId: "rating-a-movie",
  storageBucket: "rating-a-movie.firebasestorage.app",
  messagingSenderId: "213170855970",
  appId: "1:213170855970:web:1f62a4595f9446e597ea7b"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// State Management
let state = {
    user: null,
    currentView: 'search-view',
    searchResults: [],
    searchQuery: '',
    searchPage: 1,
    totalResults: 0,
    currentMovie: null,
    watchlist: [],
    filters: {
        type: '',
        sort: ''
    },
    watchlistFilters: {
        status: 'all', 
        sort: 'date-desc'
    }
};

// DOM Elements
const views = {
    search: document.getElementById('search-view'),
    detail: document.getElementById('detail-view'),
    watchlist: document.getElementById('watchlist-view')
};

const navBtns = document.querySelectorAll('.nav-btn');
const searchInput = document.getElementById('search-input');
const searchResultsContainer = document.getElementById('search-results');
const loadingState = document.getElementById('search-loading');
const emptyState = document.getElementById('search-empty');
const loadMoreBtn = document.getElementById('load-more-btn');
const typeFilter = document.getElementById('type-filter');
const sortFilter = document.getElementById('sort-filter');
const detailContent = document.getElementById('detail-content');
const backBtn = document.getElementById('back-to-search');

const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userProfile = document.getElementById('user-profile');
const userAvatar = document.getElementById('user-avatar');

// Initialization
function init() {
    setupEventListeners();
    
    // Auth State Observer
    onAuthStateChanged(auth, (user) => {
        if (user) {
            state.user = user;
            loginBtn.classList.add('hidden');
            userProfile.classList.remove('hidden');
            userAvatar.src = user.photoURL || 'https://via.placeholder.com/32';
            
            // Listen to Firestore Watchlist
            listenToWatchlist(user.uid);
        } else {
            state.user = null;
            state.watchlist = JSON.parse(localStorage.getItem('cinevault_watchlist')) || [];
            loginBtn.classList.remove('hidden');
            userProfile.classList.add('hidden');
            renderWatchlist();
            updateStats();
        }
    });
}

function listenToWatchlist(uid) {
    const watchlistRef = doc(db, 'watchlists', uid);
    onSnapshot(watchlistRef, (docSnap) => {
        if (docSnap.exists()) {
            state.watchlist = docSnap.data().items || [];
        } else {
            state.watchlist = [];
        }
        renderWatchlist();
        updateStats();
        
        // If we are looking at a movie detail, re-render to update the button state
        if (state.currentMovie) {
            renderMovieDetails(state.currentMovie);
        }
    });
}

// ==========================================
// AUTH ACTIONS
// ==========================================
async function login() {
    try {
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.error("Login failed:", error);
        alert("Login failed. Please check if Google Sign-In is enabled in Firebase Console.");
    }
}

async function logout() {
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Logout failed:", error);
    }
}

// ==========================================
// NAVIGATION
// ==========================================
function switchView(viewId) {
    state.currentView = viewId;
    
    navBtns.forEach(btn => {
        if(btn.dataset.target === viewId) btn.classList.add('active');
        else btn.classList.remove('active');
    });

    Object.values(views).forEach(view => {
        view.classList.add('hidden');
        view.classList.remove('active');
    });
    
    const activeView = document.getElementById(viewId);
    activeView.classList.remove('hidden');
    setTimeout(() => activeView.classList.add('active'), 10);

    if (viewId === 'watchlist-view') {
        renderWatchlist();
    }
}

// ==========================================
// SEARCH & API
// ==========================================
let debounceTimeout;

function handleSearch(e) {
    const query = e.target.value.trim();
    state.searchQuery = query;
    state.searchPage = 1;

    clearTimeout(debounceTimeout);
    
    if (!query) {
        searchResultsContainer.innerHTML = '';
        emptyState.classList.remove('hidden');
        loadMoreBtn.classList.add('hidden');
        return;
    }

    debounceTimeout = setTimeout(() => {
        fetchMovies(true);
    }, 500);
}

async function fetchMovies(isNewSearch = false) {
    if (isNewSearch) {
        searchResultsContainer.innerHTML = '';
        emptyState.classList.add('hidden');
        loadingState.classList.remove('hidden');
        loadMoreBtn.classList.add('hidden');
    }

    try {
        let url = `${API_URL}?apikey=${API_KEY}&s=${encodeURIComponent(state.searchQuery)}&page=${state.searchPage}`;
        if (state.filters.type) {
            url += `&type=${state.filters.type}`;
        }

        const res = await fetch(url);
        const data = await res.json();

        if (isNewSearch) loadingState.classList.add('hidden');

        if (data.Response === "True") {
            let results = data.Search;
            state.totalResults = parseInt(data.totalResults);
            
            if (state.filters.sort === 'year-desc') {
                results.sort((a, b) => parseInt(b.Year) - parseInt(a.Year));
            } else if (state.filters.sort === 'year-asc') {
                results.sort((a, b) => parseInt(a.Year) - parseInt(b.Year));
            } else if (state.filters.sort === 'title-asc') {
                results.sort((a, b) => a.Title.localeCompare(b.Title));
            }

            if (isNewSearch) {
                state.searchResults = results;
            } else {
                state.searchResults = [...state.searchResults, ...results];
            }

            renderSearchResults(results);
            
            if (state.searchResults.length < state.totalResults) {
                loadMoreBtn.classList.remove('hidden');
            } else {
                loadMoreBtn.classList.add('hidden');
            }
            
        } else {
            if (isNewSearch) {
                searchResultsContainer.innerHTML = `<p style="text-align: center; grid-column: 1/-1;">No results found for "${state.searchQuery}".</p>`;
                loadMoreBtn.classList.add('hidden');
            }
        }
    } catch (err) {
        console.error("Error fetching movies:", err);
        loadingState.classList.add('hidden');
    }
}

function renderSearchResults(movies) {
    movies.forEach(movie => {
        const card = document.createElement('div');
        card.className = 'movie-card';
        card.onclick = () => fetchMovieDetails(movie.imdbID);
        
        const posterUrl = movie.Poster !== "N/A" ? movie.Poster : 'https://via.placeholder.com/300x450?text=No+Poster';
        
        card.innerHTML = `
            <div class="poster-wrapper">
                <img src="${posterUrl}" alt="${movie.Title} poster" loading="lazy">
            </div>
            <div class="card-content">
                <h3 class="card-title" title="${movie.Title}">${movie.Title}</h3>
                <div class="card-meta">
                    <span>${movie.Year}</span>
                    <span class="card-type">${movie.Type}</span>
                </div>
            </div>
        `;
        searchResultsContainer.appendChild(card);
    });
}

// ==========================================
// MOVIE DETAILS
// ==========================================
async function fetchMovieDetails(id) {
    switchView('detail-view');
    detailContent.innerHTML = `<div class="spinner" style="margin-top: 5rem;"></div><p style="text-align:center;">Loading details...</p>`;
    
    try {
        const res = await fetch(`${API_URL}?apikey=${API_KEY}&i=${id}&plot=full`);
        const data = await res.json();
        
        if (data.Response === "True") {
            state.currentMovie = data;
            renderMovieDetails(data);
            fetchSimilarMovies(data.Genre);
        }
    } catch (err) {
        console.error(err);
        detailContent.innerHTML = `<p>Error loading movie details.</p>`;
    }
}

function renderMovieDetails(movie) {
    const posterUrl = movie.Poster !== "N/A" ? movie.Poster : 'https://via.placeholder.com/300x450?text=No+Poster';
    const bgUrl = movie.Poster !== "N/A" ? movie.Poster : '';
    
    const isSaved = state.watchlist.some(m => m.imdbID === movie.imdbID);
    const savedData = state.watchlist.find(m => m.imdbID === movie.imdbID);
    
    let genres = movie.Genre.split(', ').map(g => `<span class="tag">${g}</span>`).join('');
    
    let html = `
        <div class="detail-hero">
            <div class="detail-bg" style="background-image: url('${bgUrl}')"></div>
            <img src="${posterUrl}" alt="Poster" class="detail-poster">
            
            <div class="detail-info">
                <h1>${movie.Title}</h1>
                <div class="detail-meta-tags">
                    <span class="tag mpaa">${movie.Rated}</span>
                    <span class="tag">${movie.Year}</span>
                    <span class="tag">${movie.Runtime}</span>
                    ${movie.Type === 'series' && movie.totalSeasons ? `<span class="tag">${movie.totalSeasons} Seasons</span>` : ''}
                    <span class="tag rating"><i class="ph-fill ph-star"></i> IMDb: ${movie.imdbRating}</span>
                </div>
                
                <div class="detail-meta-tags">
                    ${genres}
                </div>
                
                <p class="detail-plot">${movie.Plot}</p>
                
                <div class="detail-crew">
                    <div class="crew-item">
                        <h4>Director</h4>
                        <p>${movie.Director}</p>
                    </div>
                    <div class="crew-item">
                        <h4>Writers</h4>
                        <p>${movie.Writer}</p>
                    </div>
                    <div class="crew-item">
                        <h4>Cast</h4>
                        <p>${movie.Actors}</p>
                    </div>
                </div>
                
                <div class="detail-actions">
                    <button class="btn btn-trailer" id="trailer-btn">
                        <i class="ph-fill ph-play-circle"></i> Watch Trailer
                    </button>
                    <button id="toggle-watchlist-btn" class="btn ${isSaved ? 'saved' : 'primary'} btn-watchlist-toggle">
                        <i class="ph-fill ${isSaved ? 'ph-check' : 'ph-plus'}"></i> 
                        ${isSaved ? 'Saved to Watchlist' : 'Add to Watchlist'}
                    </button>
                </div>
            </div>
        </div>
    `;

    if (isSaved) {
        html += renderPersonalReviewSection(savedData);
    }

    html += `
        <div class="similar-movies-section">
            <h2>You might also like</h2>
            <div id="similar-grid" class="similar-grid">
                <div class="spinner" style="margin: 2rem auto;"></div>
            </div>
        </div>
    `;

    detailContent.innerHTML = html;
    
    // Attach event listeners to the newly injected buttons
    document.getElementById('trailer-btn').onclick = () => openTrailer(movie.Title, movie.Year);
    document.getElementById('toggle-watchlist-btn').onclick = () => toggleWatchlist();
    
    if (isSaved) {
        setupStarRating();
    }
    
    fetchSimilarMovies(movie.Genre);
}

function openTrailer(title, year) {
    const query = encodeURIComponent(`${title} ${year} official trailer`);
    window.open(`https://www.youtube.com/results?search_query=${query}`, '_blank');
}

async function fetchSimilarMovies(genreString) {
    const grid = document.getElementById('similar-grid');
    if (!grid) return;

    if (!genreString || genreString === "N/A") {
        grid.innerHTML = "<p>No similar movies found.</p>";
        return;
    }
    
    const primaryGenre = genreString.split(',')[0].trim();
    
    try {
        const res = await fetch(`${API_URL}?apikey=${API_KEY}&s=${encodeURIComponent(primaryGenre)}&type=movie&page=1`);
        const data = await res.json();
        
        grid.innerHTML = '';
        
        if (data.Response === "True") {
            const similar = data.Search.filter(m => m.imdbID !== state.currentMovie.imdbID).slice(0, 6);
            
            if (similar.length === 0) {
                 grid.innerHTML = "<p>No similar movies found.</p>";
                 return;
            }

            similar.forEach(movie => {
                const poster = movie.Poster !== "N/A" ? movie.Poster : 'https://via.placeholder.com/150x225?text=No+Poster';
                const el = document.createElement('div');
                el.className = 'similar-card';
                el.onclick = () => fetchMovieDetails(movie.imdbID);
                el.innerHTML = `
                    <img src="${poster}" alt="${movie.Title}">
                    <p title="${movie.Title}">${movie.Title}</p>
                `;
                grid.appendChild(el);
            });
        } else {
             grid.innerHTML = "<p>No similar movies found.</p>";
        }
    } catch (e) {
         grid.innerHTML = "<p>Failed to load similar movies.</p>";
    }
}

// ==========================================
// WATCHLIST & PERSONAL REVIEW
// ==========================================
function toggleWatchlist() {
    const movie = state.currentMovie;
    const index = state.watchlist.findIndex(m => m.imdbID === movie.imdbID);
    
    if (index > -1) {
        state.watchlist.splice(index, 1);
    } else {
        state.watchlist.push({
            ...movie,
            addedAt: new Date().toISOString(),
            watched: false,
            favorite: false,
            personalRating: 0,
            review: '',
            personalTags: []
        });
    }
    
    saveWatchlist();
    renderMovieDetails(state.currentMovie);
}

async function saveWatchlist() {
    if (state.user) {
        const watchlistRef = doc(db, 'watchlists', state.user.uid);
        await setDoc(watchlistRef, { items: state.watchlist });
    } else {
        localStorage.setItem('cinevault_watchlist', JSON.stringify(state.watchlist));
    }
    updateStats();
}

function renderPersonalReviewSection(data) {
    let stars = '';
    for(let i=1; i<=5; i++) {
        stars += `<i class="ph-fill ph-star ${i <= data.personalRating ? 'active' : ''}" data-rating="${i}"></i>`;
    }

    return `
        <div class="personal-review-section">
            <div class="review-header">
                <h2>My Review</h2>
                <div class="watchlist-toggles">
                    <button id="mark-watched-btn" class="btn ${data.watched ? 'saved' : 'secondary'}">
                        <i class="ph-fill ph-check-circle"></i> ${data.watched ? 'Watched' : 'Mark Watched'}
                    </button>
                    <button id="mark-favorite-btn" class="btn ${data.favorite ? 'saved' : 'secondary'}">
                        <i class="ph-fill ph-heart"></i> ${data.favorite ? 'Favorited' : 'Favorite'}
                    </button>
                </div>
            </div>
            
            <div class="review-input-group">
                <div>
                    <label style="color: var(--text-secondary); display:block; margin-bottom:0.5rem;">Rating</label>
                    <div class="star-rating" id="star-rating-container">
                        ${stars}
                    </div>
                </div>
                
                <div>
                    <label style="color: var(--text-secondary); display:block; margin-bottom:0.5rem;">Notes / Review</label>
                    <textarea id="personal-review-text" placeholder="Write your thoughts here...">${data.review || ''}</textarea>
                </div>
            </div>
        </div>
    `;
}

function setupStarRating() {
    const container = document.getElementById('star-rating-container');
    if (!container) return;
    
    const stars = container.querySelectorAll('i');
    stars.forEach(star => {
        star.onclick = function() {
            const rating = parseInt(this.dataset.rating);
            updateMovieData(state.currentMovie.imdbID, 'personalRating', rating);
        };
    });

    document.getElementById('mark-watched-btn').onclick = () => {
        const movie = state.watchlist.find(m => m.imdbID === state.currentMovie.imdbID);
        updateMovieData(state.currentMovie.imdbID, 'watched', !movie.watched);
    };

    document.getElementById('mark-favorite-btn').onclick = () => {
        const movie = state.watchlist.find(m => m.imdbID === state.currentMovie.imdbID);
        updateMovieData(state.currentMovie.imdbID, 'favorite', !movie.favorite);
    };

    document.getElementById('personal-review-text').onchange = (e) => {
        updateMovieData(state.currentMovie.imdbID, 'review', e.target.value);
    };
}

function updateMovieData(id, key, value) {
    const index = state.watchlist.findIndex(m => m.imdbID === id);
    if (index > -1) {
        state.watchlist[index][key] = value;
        saveWatchlist();
        if(key === 'watched' || key === 'favorite' || key === 'personalRating') {
             renderMovieDetails(state.currentMovie);
        }
    }
}

// ==========================================
// WATCHLIST VIEW LOGIC
// ==========================================
function renderWatchlist() {
    const grid = document.getElementById('watchlist-grid');
    const empty = document.getElementById('watchlist-empty');
    if (!grid) return;
    grid.innerHTML = '';
    
    let filteredList = [...state.watchlist];
    
    if (state.watchlistFilters.status === 'watched') {
        filteredList = filteredList.filter(m => m.watched);
    } else if (state.watchlistFilters.status === 'unwatched') {
        filteredList = filteredList.filter(m => !m.watched);
    } else if (state.watchlistFilters.status === 'favorites') {
        filteredList = filteredList.filter(m => m.favorite);
    }
    
    filteredList.sort((a, b) => {
        const sort = state.watchlistFilters.sort;
        if (sort === 'date-desc') return new Date(b.addedAt) - new Date(a.addedAt);
        if (sort === 'date-asc') return new Date(a.addedAt) - new Date(b.addedAt);
        if (sort === 'title-asc') return a.Title.localeCompare(b.Title);
        if (sort === 'rating-desc') return (b.personalRating || 0) - (a.personalRating || 0);
        if (sort === 'imdb-desc') return parseFloat(b.imdbRating || 0) - parseFloat(a.imdbRating || 0);
        return 0;
    });

    if (filteredList.length === 0) {
        empty.classList.remove('hidden');
    } else {
        empty.classList.add('hidden');
        filteredList.forEach(movie => {
            const card = document.createElement('div');
            card.className = `movie-card ${movie.watched ? 'watched' : ''}`;
            card.onclick = () => fetchMovieDetails(movie.imdbID);
            
            const posterUrl = movie.Poster !== "N/A" ? movie.Poster : 'https://via.placeholder.com/300x450?text=No+Poster';
            
            let badges = '';
            if(movie.watched) badges += `<div class="badge-watched"><i class="ph-bold ph-check"></i></div>`;
            if(movie.favorite) badges += `<div class="badge-favorite"><i class="ph-fill ph-heart"></i></div>`;
            
            let starsHtml = '';
            if (movie.personalRating > 0) {
                starsHtml = `<div class="card-personal-rating">
                    ${Array(movie.personalRating).fill('<i class="ph-fill ph-star"></i>').join('')}
                </div>`;
            }
            
            card.innerHTML = `
                ${badges}
                <div class="poster-wrapper">
                    <img src="${posterUrl}" alt="${movie.Title}" loading="lazy">
                </div>
                <div class="card-content">
                    <h3 class="card-title" title="${movie.Title}">${movie.Title}</h3>
                    <div class="card-meta">
                        <span>${movie.Year}</span>
                        <span><i class="ph-fill ph-star" style="color:var(--accent-star)"></i> ${movie.imdbRating}</span>
                    </div>
                    ${starsHtml}
                </div>
            `;
            grid.appendChild(card);
        });
    }
}

function updateStats() {
    const list = state.watchlist;
    const total = list.length;
    const watched = list.filter(m => m.watched).length;
    
    const ratedMovies = list.filter(m => m.personalRating > 0);
    const avgRating = ratedMovies.length ? (ratedMovies.reduce((sum, m) => sum + m.personalRating, 0) / ratedMovies.length).toFixed(1) : '0';
    
    let runtimeMins = 0;
    list.filter(m => m.watched).forEach(m => {
        const match = m.Runtime.match(/\d+/);
        if (match) runtimeMins += parseInt(match[0]);
    });
    const hours = Math.floor(runtimeMins / 60);
    const mins = runtimeMins % 60;
    const runtimeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

    const dashboard = document.getElementById('stats-dashboard');
    if (dashboard) {
        dashboard.innerHTML = `
            <div class="stat-card">
                <div class="value">${total}</div>
                <div style="color:var(--text-secondary); font-size:0.85rem">Total Saved</div>
            </div>
            <div class="stat-card">
                <div class="value">${watched}</div>
                <div style="color:var(--text-secondary); font-size:0.85rem">Watched</div>
            </div>
            <div class="stat-card">
                <div class="value">${avgRating}</div>
                <div style="color:var(--text-secondary); font-size:0.85rem">Avg Rating</div>
            </div>
            <div class="stat-card">
                <div class="value">${runtimeStr}</div>
                <div style="color:var(--text-secondary); font-size:0.85rem">Watched Time</div>
            </div>
        `;
    }
}

function exportWatchlist() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state.watchlist, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href",     dataStr);
    downloadAnchorNode.setAttribute("download", "cinevault_watchlist.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

// ==========================================
// EVENT LISTENERS SETUP
// ==========================================
function setupEventListeners() {
    loginBtn.onclick = login;
    logoutBtn.onclick = logout;

    navBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget.dataset.target;
            if(target) switchView(target);
        });
    });

    searchInput.addEventListener('input', handleSearch);
    typeFilter.addEventListener('change', (e) => {
        state.filters.type = e.target.value;
        if(state.searchQuery) fetchMovies(true);
    });
    sortFilter.addEventListener('change', (e) => {
        state.filters.sort = e.target.value;
        if(state.searchQuery) fetchMovies(true);
    });
    loadMoreBtn.addEventListener('click', () => {
        state.searchPage++;
        fetchMovies();
    });

    backBtn.addEventListener('click', () => {
        switchView('search-view');
    });

    const discoverBtn = document.getElementById('go-to-search-btn');
    if (discoverBtn) discoverBtn.onclick = () => switchView('search-view');
    
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            state.watchlistFilters.status = e.currentTarget.dataset.filter;
            renderWatchlist();
        });
    });

    const watchlistSort = document.getElementById('watchlist-sort');
    if (watchlistSort) {
        watchlistSort.addEventListener('change', (e) => {
            state.watchlistFilters.sort = e.target.value;
            renderWatchlist();
        });
    }

    const exportBtn = document.getElementById('export-watchlist');
    if (exportBtn) exportBtn.onclick = exportWatchlist;
}

// Global scope attachments for HTML onclick (if any remain)
window.fetchMovieDetails = fetchMovieDetails;
window.toggleWatchlist = toggleWatchlist;
window.openTrailer = openTrailer;

// Start
init();
